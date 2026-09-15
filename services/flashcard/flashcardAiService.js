import HttpError from "../../utils/httpError.js";
import { getOpenAIClient, getOpenAIModel } from "../../utils/ai/openaiClient.js";
import {
    assignSourcesToItems,
    compressRagContext,
    computeContentHash,
    extractSourcesMetadata,
    extractToolJson,
    filterDeicticChunks,
    formatContextForPrompt,
    remainingTimeMs,
    repairJsonWithLlm,
    sanitizeTitle,
} from "../../utils/ai/llmHelpers.js";
import { retrieveContext } from "../ragService.js";
import { logAiUsage } from "../../utils/ai/aiUsageTracker.js";

const GENERATION_SLA_MS = Number(process.env.GENERATION_SLA_MS || 60000);
const RAG_DEADLINE_MS = Number(process.env.RAG_DEADLINE_MS || 10000);
const PRIMARY_LLM_MS = Number(process.env.PRIMARY_LLM_MS || 35000);
const REPAIR_LLM_MS = Number(process.env.REPAIR_LLM_MS || 5000);
const OPENAI_TEMP = Number(process.env.OPENAI_TEMP || 0.35);
const TOOL_NAME = "propose_flashcards";

const FLASHCARD_TOOL_SCHEMA = {
    name: TOOL_NAME,
    description: "Return a list of flashcards for study with source provenance",
    parameters: {
        type: "object",
        properties: {
            title: { type: "string" },
            flashcards: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        front: { type: "string", minLength: 1 },
                        back: { type: "string", minLength: 1 },
                        difficulty: {
                            type: "string",
                            enum: ["easy", "medium", "hard"],
                        },
                        sources: {
                            type: "array",
                            items: { type: "integer" },
                        },
                    },
                    required: ["front", "back"],
                },
                minItems: 1,
            },
            sources: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        chunk_id: { type: "integer" },
                        doc_id: { type: "integer" },
                        page: { type: "integer" },
                        qref: { type: "string" },
                    },
                    required: ["chunk_id"],
                },
            },
        },
        required: ["flashcards"],
    },
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const schemaForCount = (count) => {
    const schema = clone(FLASHCARD_TOOL_SCHEMA);
    schema.parameters.properties.flashcards.minItems = count;
    schema.parameters.properties.flashcards.maxItems = count;
    schema.parameters.properties.flashcards.items.properties.sources.items = {
        type: "integer",
    };
    return schema;
};

const validateFlashcards = (payload) => {
    if (!payload || typeof payload !== "object") {
        return { title: "", items: [], sources: [] };
    }
    const rawItems = Array.isArray(payload.flashcards)
        ? payload.flashcards
        : Array.isArray(payload.items)
            ? payload.items
            : [];
    const items = rawItems
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
            front: String(item.front ?? item.front_text ?? "").trim(),
            back: String(item.back ?? item.back_text ?? "").trim(),
            difficulty: ["easy", "medium", "hard"].includes(
                String(item.difficulty || "").toLowerCase()
            )
                ? String(item.difficulty).toLowerCase()
                : undefined,
            sources: Array.isArray(item.sources)
                ? item.sources
                    .map((source) => Number(source))
                    .filter((source) => Number.isInteger(source) && source > 0)
                : [],
        }))
        .filter((item) => item.front && item.back);

    const sources = Array.isArray(payload.sources)
        ? payload.sources
            .filter((source) => source && Number(source.chunk_id) > 0)
            .map((source) => ({
                ...source,
                chunk_id: Number(source.chunk_id),
                doc_id: source.doc_id === undefined ? undefined : Number(source.doc_id),
                page: source.page === undefined ? undefined : Number(source.page),
            }))
        : [];

    return {
        title: String(payload.title || "").trim(),
        items,
        sources,
    };
};

const buildTool = (count) => {
    const schema = schemaForCount(count);
    return {
        schema,
        tools: [{
            type: "function",
            function: {
                name: schema.name,
                description: schema.description,
                parameters: schema.parameters,
            },
        }],
    };
};

const callModel = async ({
    client,
    model,
    count,
    system,
    user,
    temperature = OPENAI_TEMP,
    allowRepair = true,
    startMs,
    userId = null,
}) => {
    if (remainingTimeMs(startMs) < 1000) return { title: "", items: [], sources: [] };
    const tool = buildTool(count);
    let response;
    try {
        response = await client.chat.completions.create({
            model,
            temperature,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            tools: tool.tools,
            tool_choice: "auto",
            max_tokens: Math.max(300, count * 300),
        });
    } catch (error) {
        return { title: "", items: [], sources: [], error };
    }

    logAiUsage({ userId, feature: "flashcard_generation", model, response });

    let parsed = extractToolJson(response, TOOL_NAME);
    let validated = validateFlashcards(parsed);
    if (validated.items.length > 0 || !allowRepair) return validated;

    if (remainingTimeMs(startMs) > REPAIR_LLM_MS) {
        const content = response.choices?.[0]?.message?.content || "";
        const repaired = await repairJsonWithLlm(
            client,
            content,
            tool.schema.parameters,
            model,
            Math.max(1, Math.ceil(Math.min(REPAIR_LLM_MS, remainingTimeMs(startMs)) / 1000))
        );
        validated = validateFlashcards(repaired);
    }
    return validated;
};

const retrieveFlashcardContext = async ({
    subjectCode,
    query,
    count,
    startMs,
}) => {
    if (!subjectCode || remainingTimeMs(startMs) < 500) {
        return { fused: [], syllabusOutline: "", sources: [] };
    }

    const call = async (options) => {
        const remaining = Math.min(
            RAG_DEADLINE_MS,
            Math.max(500, remainingTimeMs(startMs))
        );
        return Promise.race([
            retrieveContext(options),
            new Promise((_, reject) => setTimeout(
                () => reject(new Error("RAG retrieval deadline exceeded.")),
                remaining
            )),
        ]);
    };

    try {
        const syllabusResponse = await call({
            subjectCode,
            query,
            modes: ["text"],
            filters: { doctype: ["syllabus"] },
            kText: 5,
            kClipText: 0,
            kImage: 0,
            maxContextTokens: 800,
            recencyBoost: false,
        });
        const syllabusItems = Array.isArray(syllabusResponse.fused)
            ? syllabusResponse.fused
            : [];
        const syllabusOutline = syllabusItems
            .map((item) => String(item.text || "").trim())
            .filter(Boolean)
            .join("\n")
            .slice(0, 800);

        const pastResponse = await call({
            subjectCode,
            query,
            modes: ["text"],
            filters: { doctype: ["past_paper"] },
            kText: 40,
            kClipText: 0,
            kImage: 0,
            maxContextTokens: 50000,
            recencyBoost: true,
        });
        const pastItems = Array.isArray(pastResponse.fused)
            ? pastResponse.fused
            : [];
        const fused = [...syllabusItems, ...pastItems]
            .filter((item, index, all) => (
                item?.chunk_id &&
                all.findIndex((candidate) => (
                    Number(candidate?.chunk_id) === Number(item.chunk_id)
                )) === index
            ));
        return {
            fused,
            syllabusOutline,
            sources: extractSourcesMetadata(fused),
        };
    } catch {
        return { fused: [], syllabusOutline: "", sources: [] };
    }
};

const dedupeItems = (items) => {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter((item) => {
        const hash = computeContentHash(`${item.front} ${item.back}`);
        if (seen.has(hash)) return false;
        seen.add(hash);
        return true;
    });
};

const buildContextPrompt = ({
    subjectName,
    topic,
    prompt,
    count,
    difficulty,
    syllabusOutline,
    contextItems,
}) => [
    `Subject: ${subjectName}`,
    `Topic: ${topic || "(not specified)"}`,
    `Target: ${count}`,
    `Difficulty: ${difficulty}`,
    `Prompt: ${prompt || "(none)"}`,
    "Syllabus outline:",
    syllabusOutline || "(not available)",
    "== CONTEXT START ==",
    formatContextForPrompt(contextItems, 12000) || "(no retrieved context)",
    "== CONTEXT END ==",
    `Return exactly ${count} unique flashcards. Every claim must be supported by the syllabus/context.`,
].join("\n");

export const generateFlashcardsWithAi = async ({
    subjectName,
    topic = "",
    prompt = "",
    count = 10,
    difficulty = "medium",
    subjectCode = "",
    userId = null,
}) => {
    if (!process.env.OPENAI_API_KEY) {
        throw new HttpError(503, "AI flashcard generation is not configured.");
    }

    const safeCount = Math.min(30, Math.max(1, Number(count) || 10));
    const safeDifficulty = ["easy", "medium", "hard"].includes(
        String(difficulty).toLowerCase()
    )
        ? String(difficulty).toLowerCase()
        : "medium";
    const startMs = Date.now();
    const client = getOpenAIClient();
    const model = getOpenAIModel();
    const query = prompt.trim().length > 10
        ? `${subjectCode} ${prompt.split(/\s+/).filter((word) => word.length > 2).slice(0, 10).join(" ")}`
        : topic.trim().length > 3
            ? `${subjectCode} ${topic} ${subjectName}`
            : `${subjectCode} ${subjectName} study material`;

    const context = await retrieveFlashcardContext({
        subjectCode,
        query,
        count: safeCount,
        startMs,
    });
    let fused = context.fused;
    if (fused.length < 10 && remainingTimeMs(startMs) > 500) {
        try {
            const widened = await retrieveContext({
                subjectCode,
                query,
                modes: ["text"],
                filters: {},
                kText: 50,
                kClipText: 0,
                kImage: 0,
                maxContextTokens: 50000,
                recencyBoost: true,
            });
            const widenedItems = Array.isArray(widened.fused)
                ? widened.fused
                : [];
            fused = [...fused, ...widenedItems]
                .filter((item, index, all) => (
                    item?.chunk_id &&
                    all.findIndex((candidate) => (
                        Number(candidate?.chunk_id) === Number(item.chunk_id)
                    )) === index
                ));
        } catch {
            // Continue with the context already retrieved.
        }
    }
    const [filteredContext] = filterDeicticChunks(fused);
    const contextItems = compressRagContext(
        filteredContext,
        Math.min(8000, Math.max(4000, safeCount * 250)),
        Math.min(25, Math.max(10, safeCount))
    );
    const system = [
        "You are a pedagogy assistant producing study flashcards. Follow the tool schema exactly.",
        `Return exactly ${safeCount} flashcards.`,
        "Each front must be a self-contained question or term; each back must be a concise, accurate answer or definition.",
        "Avoid dependence on figures, diagrams, tables, or vague references; restate needed context.",
        "Stay strictly within the syllabus outline and retrieved context. Do not invent facts.",
        "Use the top 1-3 relevant chunk IDs as sources for each item. Do not duplicate cards.",
        "Use plain strings without Markdown and return data through the provided tool only.",
    ].join(" ");
    const primary = await callModel({
        client,
        model,
        count: safeCount,
        system,
        user: buildContextPrompt({
            subjectName,
            topic,
            prompt,
            count: safeCount,
            difficulty: safeDifficulty,
            syllabusOutline: context.syllabusOutline,
            contextItems,
        }),
        startMs,
        userId,
    });

    let title = primary.title;
    let items = dedupeItems(primary.items);
    let sources = [
        ...extractSourcesMetadata(filteredContext),
        ...primary.sources,
    ];

    if (items.length === 0 && remainingTimeMs(startMs) > PRIMARY_LLM_MS / 2) {
        const fallback = await callModel({
            client,
            model,
            count: safeCount,
            temperature: OPENAI_TEMP + 0.1,
            system: "Create accurate, self-contained study flashcards. Return exactly the requested number through the provided tool. Do not use Markdown, vague references, or duplicate cards.",
            user: [
                `Subject: ${subjectName}`,
                `Topic: ${topic || "(not specified)"}`,
                `Prompt: ${prompt || "(none)"}`,
                `Difficulty: ${safeDifficulty}`,
                `Return exactly ${safeCount} unique flashcards.`,
            ].join("\n"),
            startMs,
            userId,
        });
        title = title || fallback.title;
        items = dedupeItems(fallback.items);
        sources = [...sources, ...fallback.sources];
    }

    while (items.length < safeCount && remainingTimeMs(startMs) > 2000) {
        const missing = safeCount - items.length;
        const topup = await callModel({
            client,
            model,
            count: missing,
            temperature: OPENAI_TEMP + 0.15,
            system: `Generate exactly ${missing} additional unique study flashcards through the provided tool. Keep them self-contained and concise; do not repeat existing concepts.`,
            user: `Subject: ${subjectName}\nTopic: ${topic || prompt || "(general study)"}\nDifficulty: ${safeDifficulty}`,
            startMs,
            userId,
        });
        const unique = dedupeItems([...items, ...topup.items]);
        if (unique.length <= items.length) break;
        items = unique;
        title = title || topup.title;
        sources = [...sources, ...topup.sources];
    }

    if (items.length === 0) {
        throw new HttpError(502, "AI returned no valid flashcards.");
    }

    const [assignedItems] = assignSourcesToItems(
        items,
        filteredContext,
        ["front", "back"],
        2
    );
    const fallbackTitle = topic || prompt.slice(0, 50) || `${subjectName} Study Set`;
    const finalTitle = sanitizeTitle(title, fallbackTitle, 50);
    const syllabusIds = new Set(
        sources
            .filter((source) => String(source.document_type).toLowerCase() === "syllabus")
            .map((source) => Number(source.chunk_id))
    );
    const displaySources = sources.filter(
        (source) => String(source.document_type).toLowerCase() !== "syllabus"
    );
    for (const item of assignedItems) {
        const original = Array.isArray(item.sources) ? item.sources : [];
        const filtered = original.filter((source) => !syllabusIds.has(Number(source)));
        if (filtered.length > 0) item.sources = filtered;
    }

    return {
        title: finalTitle,
        flashcards: assignedItems.slice(0, safeCount),
        sources: displaySources.length > 0
            ? displaySources
            : sources.slice(0, 3),
    };
};
