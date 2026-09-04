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
    sanitizeTitle,
} from "../../utils/ai/llmHelpers.js";
import { retrieveContext } from "../ragService.js";

const TOOL_NAME = "propose_quiz";
const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const createSchema = (count) => ({
    type: "object",
    properties: {
        title: { type: "string", maxLength: 50 },
        questions: {
            type: "array",
            minItems: count,
            maxItems: count,
            items: {
                type: "object",
                properties: {
                    stem: { type: "string", minLength: 10 },
                    options: {
                        type: "array",
                        minItems: 4,
                        maxItems: 4,
                        items: { type: "string", minLength: 1 },
                    },
                    answer_index: {
                        type: "integer",
                        minimum: 0,
                        maximum: 3,
                    },
                    explanation: { type: "string" },
                    sources: {
                        type: "array",
                        items: { type: "integer" },
                    },
                },
                required: [
                    "stem",
                    "options",
                    "answer_index",
                    "explanation",
                ],
            },
        },
    },
    required: ["questions"],
});

const normalizeQuestions = (payload) => {
    const rawQuestions = Array.isArray(payload?.questions)
        ? payload.questions
        : [];

    return rawQuestions
        .filter((question) => (
            question &&
            typeof question === "object" &&
            String(question.stem || "").trim().length >= 10 &&
            Array.isArray(question.options) &&
            question.options.length === 4 &&
            Number.isInteger(Number(question.answer_index)) &&
            Number(question.answer_index) >= 0 &&
            Number(question.answer_index) <= 3
        ))
        .map((question) => ({
            stem: String(question.stem).trim(),
            options: question.options.map((option) => String(option).trim()),
            answer_index: Number(question.answer_index),
            explanation: String(question.explanation || "").trim(),
            sources: Array.isArray(question.sources)
                ? question.sources
                    .map(Number)
                    .filter((source) => Number.isInteger(source) && source > 0)
                : [],
        }))
        .filter((question) => question.options.every(Boolean));
};

const callModel = async ({
    client,
    model,
    count,
    system,
    user,
    temperature,
}) => {
    const schema = createSchema(count);
    const response = await client.chat.completions.create({
        model,
        temperature,
        messages: [
            { role: "system", content: system },
            { role: "user", content: user },
        ],
        tools: [{
            type: "function",
            function: {
                name: TOOL_NAME,
                description: "Return a multiple-choice quiz with questions and answers.",
                parameters: schema,
            },
        }],
        tool_choice: {
            type: "function",
            function: { name: TOOL_NAME },
        },
        max_tokens: Math.max(1000, count * 300),
    });

    const payload = extractToolJson(response, TOOL_NAME) || {};
    return {
        title: String(payload.title || "").trim(),
        questions: normalizeQuestions(payload),
    };
};

const retrieveQuizContext = async (subjectCode, subjectName, prompt) => {
    if (!subjectCode) {
        return {
            items: [],
            sources: [],
            syllabusOutline: "",
        };
    }

    const query = prompt.trim().length > 10
        ? `${subjectCode} ${prompt}`
        : `${subjectCode} ${subjectName} study material`;

    try {
        const [syllabusResult, contentResult] = await Promise.all([
            retrieveContext({
                subjectCode,
                query,
                modes: ["text"],
                filters: { doctype: ["syllabus"] },
                kText: 5,
                kClipText: 0,
                kImage: 0,
                maxContextTokens: 1200,
                recencyBoost: false,
            }),
            retrieveContext({
                subjectCode,
                query,
                modes: ["text"],
                filters: {},
                kText: 50,
                kClipText: 0,
                kImage: 0,
                maxContextTokens: 50000,
                recencyBoost: true,
            }),
        ]);

        const syllabusItems = Array.isArray(syllabusResult?.fused)
            ? syllabusResult.fused
            : [];
        const contentItems = Array.isArray(contentResult?.fused)
            ? contentResult.fused
            : [];
        const uniqueItems = [...syllabusItems, ...contentItems].filter(
            (item, index, items) => (
                item?.chunk_id &&
                items.findIndex(
                    (candidate) => Number(candidate?.chunk_id) === Number(item.chunk_id)
                ) === index
            )
        );
        const [items] = filterDeicticChunks(uniqueItems);

        return {
            items,
            sources: extractSourcesMetadata(items),
            syllabusOutline: syllabusItems
                .map((item) => String(item.text || "").trim())
                .filter(Boolean)
                .join("\n")
                .slice(0, 1200),
        };
    } catch {
        return {
            items: [],
            sources: [],
            syllabusOutline: "",
        };
    }
};

const dedupeQuestions = (questions) => {
    const seen = new Set();

    return questions.filter((question) => {
        const hash = computeContentHash(question.stem);
        if (seen.has(hash)) return false;
        seen.add(hash);
        return true;
    });
};

export const generateQuizWithAi = async ({
    subjectName,
    subjectCode,
    prompt,
    count,
    title,
    difficulty,
}) => {
    if (!process.env.OPENAI_API_KEY) {
        throw new HttpError(503, "AI quiz generation is not configured.");
    }

    const safeCount = [10, 20].includes(Number(count)) ? Number(count) : 10;
    const safeDifficulty = VALID_DIFFICULTIES.has(String(difficulty).toLowerCase())
        ? String(difficulty).toLowerCase()
        : "medium";
    const client = getOpenAIClient();
    const model = getOpenAIModel();
    const context = await retrieveQuizContext(
        subjectCode,
        subjectName,
        String(prompt || "")
    );
    const contextItems = compressRagContext(
        context.items,
        Math.min(12000, Math.max(6000, safeCount * 350)),
        Math.min(40, Math.max(15, Math.ceil(safeCount * 1.5)))
    );
    const system = [
        "You are a pedagogy assistant producing exam-style multiple-choice questions.",
        `Generate exactly ${safeCount} unique questions.`,
        "Each question must have exactly four options and one correct answer.",
        "Questions must be self-contained and must not refer vaguely to a figure, diagram, passage, or table.",
        "Stay within the supplied syllabus and context when context is present.",
        "Use the top one to three supporting chunk IDs in each question's sources.",
        "Use plain text and return only through the supplied tool.",
    ].join(" ");
    const user = [
        `Subject: ${subjectName}`,
        `Difficulty: ${safeDifficulty}`,
        `Requested title: ${title || "(generate one)"}`,
        `Prompt: ${prompt}`,
        "Syllabus:",
        context.syllabusOutline || "(not available)",
        "Context:",
        formatContextForPrompt(contextItems, 12000) || "(not available)",
    ].join("\n");

    let result;
    try {
        result = await callModel({
            client,
            model,
            count: safeCount,
            system,
            user,
            temperature: Number(process.env.OPENAI_TEMP || 0.35),
        });
    } catch (error) {
        throw new HttpError(502, `AI quiz generation failed: ${error.message}`);
    }

    let questions = dedupeQuestions(result.questions);

    while (questions.length < safeCount) {
        const missing = safeCount - questions.length;
        let topup;
        try {
            topup = await callModel({
                client,
                model,
                count: missing,
                system: `Generate exactly ${missing} additional unique, self-contained multiple-choice questions through the supplied tool.`,
                user: `Subject: ${subjectName}\nDifficulty: ${safeDifficulty}\nPrompt: ${prompt}`,
                temperature: Number(process.env.OPENAI_TEMP || 0.35) + 0.15,
            });
        } catch {
            break;
        }

        const combined = dedupeQuestions([...questions, ...topup.questions]);
        if (combined.length === questions.length) break;
        questions = combined;
    }

    if (questions.length === 0) {
        throw new HttpError(502, "AI returned no valid quiz questions.");
    }

    const [assignedQuestions] = assignSourcesToItems(
        questions,
        context.items,
        ["stem", "explanation"],
        2
    );
    const syllabusIds = new Set(
        context.sources
            .filter((source) => String(source.document_type || "").toLowerCase() === "syllabus")
            .map((source) => Number(source.chunk_id))
    );
    const displaySources = context.sources.filter(
        (source) => String(source.document_type || "").toLowerCase() !== "syllabus"
    );

    for (const question of assignedQuestions) {
        const filtered = question.sources.filter(
            (source) => !syllabusIds.has(Number(source))
        );
        if (filtered.length > 0) question.sources = filtered;
    }

    return {
        title: sanitizeTitle(
            result.title,
            title || String(prompt).slice(0, 50) || `${subjectName} Quiz`,
            50
        ),
        questions: assignedQuestions.slice(0, safeCount),
        sources: displaySources.length > 0
            ? displaySources
            : context.sources.slice(0, 3),
    };
};
