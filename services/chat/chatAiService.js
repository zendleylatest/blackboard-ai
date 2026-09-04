import { Storage } from "@google-cloud/storage";
import { toFile } from "openai/uploads";
import HttpError from "../../utils/httpError.js";
import {
    getOpenAIClient,
    getOpenAIGatingModel,
    getOpenAIModel,
} from "../../utils/ai/openaiClient.js";
import {
    coerceChatAnswer,
    coerceChunkIds,
    coerceSources,
} from "../../utils/ai/chatPayloads.js";
import {
    compressRagContext,
    extractSourcesMetadata,
    extractToolJson,
    formatContextForPrompt,
} from "../../utils/ai/llmHelpers.js";
import { retrieveContext } from "../ragService.js";

const CHAT_TOOL_SCHEMA = {
    name: "propose_chat_answer",
    description: "Return a grounded tutoring response with sources",
    parameters: {
        type: "object",
        properties: {
            answer: { type: "string", minLength: 1 },
            sources: {
                type: "array",
                items: { type: "integer" },
            },
        },
        required: ["answer"],
    },
};

const GATING_TOOL_SCHEMA = {
    name: "rag_gate_decision",
    description: "Classify whether a tutoring query needs RAG or belongs to another subject",
    parameters: {
        type: "object",
        properties: {
            is_conversational: { type: "boolean" },
            needs_rag: { type: "boolean" },
            off_topic: { type: "boolean" },
            is_past_paper_query: { type: "boolean" },
            linkable: { type: "boolean" },
            subject_mismatch: { type: "boolean" },
            suggested_subject: { type: "string" },
            subject_relevance_score: {
                type: "number",
                minimum: 0,
                maximum: 100,
            },
            year_hint: { type: "number" },
            paper_hint: { type: "string" },
            qref_hint: { type: "string" },
            reasoning: { type: "string" },
        },
        required: [
            "is_conversational",
            "needs_rag",
            "off_topic",
            "is_past_paper_query",
        ],
    },
};

const makeChatCompletionTool = (schema) => ({
    type: "function",
    function: {
        name: schema.name,
        description: schema.description,
        parameters: schema.parameters,
    },
});

const makeResponsesTool = (schema) => ({
    type: "function",
    name: schema.name,
    description: schema.description,
    parameters: schema.parameters,
});

const normalizeGate = (gate) => ({
    ...gate,
    is_conversational: gate.is_conversational === true ||
        String(gate.is_conversational).toLowerCase() === "true",
    needs_rag: gate.needs_rag === true ||
        String(gate.needs_rag).toLowerCase() === "true",
    off_topic: gate.off_topic === true ||
        String(gate.off_topic).toLowerCase() === "true",
    is_past_paper_query: gate.is_past_paper_query === true ||
        String(gate.is_past_paper_query).toLowerCase() === "true",
    linkable: gate.linkable === undefined
        ? true
        : gate.linkable === true ||
            String(gate.linkable).toLowerCase() === "true",
    subject_mismatch: gate.subject_mismatch === true ||
        String(gate.subject_mismatch).toLowerCase() === "true",
});

const decideRag = async ({
    client,
    subjectCode,
    subjectName,
    userText,
}) => {
    const fallback = {
        is_conversational: /^(hi|hello|hey|thanks|thank you)\b/i.test(userText),
        needs_rag: Boolean(subjectCode && userText.trim()),
        off_topic: false,
        is_past_paper_query: /\b(past paper|exam|mark scheme|question paper|tested)\b/i.test(userText),
        linkable: true,
        subject_mismatch: false,
    };
    try {
        const response = await client.chat.completions.create({
            model: getOpenAIGatingModel(),
            temperature: Number(process.env.GATING_TEMP || 0),
            messages: [
                {
                    role: "system",
                    content: [
                        "Classify whether this tutoring message is conversational, requires subject RAG, or belongs to another subject.",
                        "Use needs_rag for syllabus facts, worked explanations, citations, past papers, and mark schemes.",
                        "Set subject_mismatch only when clearly outside the current subject and not reasonably linkable.",
                        "Extract year, paper, and question-reference hints when present.",
                        "Return only through the provided function.",
                    ].join(" "),
                },
                {
                    role: "user",
                    content: `Current subject: ${subjectName || subjectCode || "General"} (${subjectCode || "general"})\n\nUser query:\n${userText}`,
                },
            ],
            tools: [makeChatCompletionTool(GATING_TOOL_SCHEMA)],
            tool_choice: {
                type: "function",
                function: { name: GATING_TOOL_SCHEMA.name },
            },
            max_tokens: Number(process.env.GATING_MAX_OUTPUT_TOKENS || 180),
        });
        return normalizeGate({
            ...fallback,
            ...(extractToolJson(response, GATING_TOOL_SCHEMA.name) || {}),
        });
    } catch {
        return normalizeGate(fallback);
    }
};

const buildRagQuery = (subjectCode, userText, gate) => {
    const terms = [
        subjectCode,
        ...String(userText)
            .split(/\s+/)
            .filter((word) => word.length > 2)
            .slice(0, 10),
    ];
    if (gate.is_past_paper_query) {
        terms.push("past", "paper", "exam", "question", "mark", "scheme");
    }
    for (const hint of [gate.year_hint, gate.paper_hint, gate.qref_hint]) {
        if (hint) terms.push(String(hint));
    }
    return [...new Set(terms.filter(Boolean).map((term) => String(term).toLowerCase()))]
        .slice(0, 20)
        .join(" ");
};

const retrieveChatContext = async ({
    subjectCode,
    query,
    needsRag,
}) => {
    if (!subjectCode || !needsRag) {
        return { fused: [], syllabusOutline: "" };
    }
    try {
        const [syllabus, papers] = await Promise.all([
            retrieveContext({
                subjectCode,
                query,
                modes: ["text"],
                filters: { doctype: ["syllabus"] },
                kText: 5,
                kClipText: 0,
                kImage: 0,
                maxContextTokens: 800,
                recencyBoost: false,
            }),
            retrieveContext({
                subjectCode,
                query,
                modes: ["text"],
                filters: { doctype: ["past_paper"] },
                kText: 15,
                kClipText: 0,
                kImage: 0,
                maxContextTokens: 5200,
                recencyBoost: true,
            }),
        ]);
        const syllabusItems = Array.isArray(syllabus.fused) ? syllabus.fused : [];
        const paperItems = Array.isArray(papers.fused) ? papers.fused : [];
        const fused = [...syllabusItems, ...paperItems]
            .filter((item, index, all) => (
                item?.chunk_id &&
                all.findIndex((candidate) => (
                    Number(candidate?.chunk_id) === Number(item.chunk_id)
                )) === index
            ));
        return {
            fused,
            syllabusOutline: syllabusItems
                .slice(0, 3)
                .map((item) => String(item.text || "").trim())
                .filter(Boolean)
                .join("\n")
                .slice(0, 800),
        };
    } catch {
        return { fused: [], syllabusOutline: "" };
    }
};

const formatSource = (source) => {
    const doc = source.doc || {};
    const documentType = String(
        source.document_type || doc.document_type || ""
    ).toLowerCase();
    const output = {
        chunk_id: Number(source.chunk_id),
        doc_id: source.doc_id || doc.id || null,
        page: source.page ?? null,
        qref: source.qref || "",
        subject_code: source.subject_code || doc.subject_code || "",
        year: source.year || doc.year || "",
        series: source.series || doc.series || "",
        document_type: documentType,
        paper: source.paper || doc.paper || "",
        variant: source.variant || doc.variant || "",
        kind: source.kind || "text",
    };
    output.doc = {
        id: output.doc_id,
        subject_code: output.subject_code,
        year: output.year,
        series: output.series,
        paper: output.paper,
        variant: output.variant,
        document_type: output.document_type,
    };
    output.display_name = documentType === "past_paper"
        ? `${output.subject_code} Past Paper ${output.year} ${output.series} ${output.paper}`.replace(/\s+/g, " ").trim()
        : "Study Material";
    return output;
};

const extractAnswer = (response) => {
    const toolPayload = extractToolJson(response, CHAT_TOOL_SCHEMA.name);
    if (toolPayload) {
        return {
            answer: coerceChatAnswer(toolPayload.answer),
            requestedSources: coerceChunkIds(
                toolPayload.chunk_ids ?? toolPayload.sources
            ),
            toolSources: coerceSources(toolPayload.sources),
        };
    }
    return {
        answer: coerceChatAnswer(
            response?.output_text ||
            response?.choices?.[0]?.message?.content
        ),
        requestedSources: [],
        toolSources: [],
    };
};

const callAssistant = async ({
    client,
    model,
    input,
    chatMessages,
    mode,
}) => {
    try {
        const response = await client.responses.create({
            model,
            input,
            tools: [makeResponsesTool(CHAT_TOOL_SCHEMA)],
            tool_choice: {
                type: "function",
                name: CHAT_TOOL_SCHEMA.name,
            },
            temperature: Number(process.env.OPENAI_TEMP || 0.35),
            max_output_tokens: mode === "checker"
                ? 2500
                : mode === "mcq_review"
                    ? 3000
                    : 2000,
        });
        return extractAnswer(response);
    } catch {
        const response = await client.chat.completions.create({
            model,
            temperature: Number(process.env.OPENAI_TEMP || 0.35),
            messages: chatMessages,
            tools: [makeChatCompletionTool(CHAT_TOOL_SCHEMA)],
            tool_choice: {
                type: "function",
                function: { name: CHAT_TOOL_SCHEMA.name },
            },
            max_tokens: mode === "checker"
                ? 2500
                : mode === "mcq_review"
                    ? 3000
                    : 2000,
        });
        return extractAnswer(response);
    }
};

export const generateChatAssistantResponse = async ({
    subjectCode = "",
    subjectName = "",
    userText,
    recentMessages = [],
    mode = "assistant",
    overrideGating = false,
    attachments = [],
    paperContext = "",
    sourceDocuments = [],
}) => {
    if (!process.env.OPENAI_API_KEY) {
        throw new HttpError(503, "Chat assistant is not configured.");
    }
    const client = getOpenAIClient();
    const gate = await decideRag({
        client,
        subjectCode,
        subjectName,
        userText,
    });
    const relevanceThreshold = Number(process.env.GATING_RELEVANCE_THRESHOLD || 30);
    const shouldSwitch = Boolean(
        subjectCode &&
        !overrideGating &&
        !gate.is_conversational &&
        (
            gate.off_topic ||
            (gate.subject_mismatch && !gate.linkable) ||
            (
                Number.isFinite(Number(gate.subject_relevance_score)) &&
                Number(gate.subject_relevance_score) < relevanceThreshold &&
                !gate.linkable
            )
        )
    );
    if (shouldSwitch) {
        const suggested = gate.suggested_subject || "another subject";
        const current = subjectName || subjectCode || "current subject";
        return {
            answer: `Your question looks more related to **${suggested}** than **${current}**.\n\nYou can switch to ${suggested} for a better answer, or I can try to answer it in ${current}.`,
            sources: [],
            chunk_ids: [],
            subject_mismatch: true,
            suggested_subject: suggested,
            current_subject: current,
            current_subject_code: subjectCode,
            reasoning: gate.reasoning || "",
        };
    }

    const query = buildRagQuery(subjectCode, userText, gate);
    const context = await retrieveChatContext({
        subjectCode,
        query,
        needsRag: Boolean(gate.needs_rag && attachments.length === 0),
    });
    let fused = context.fused;
    if (gate.is_past_paper_query) {
        const papers = fused.filter(
            (item) => item.doc?.document_type === "past_paper"
        );
        if (papers.length > 0) {
            fused = [...papers, ...fused.filter((item) => !papers.includes(item)).slice(0, 5)];
        }
    }
    const contextItems = compressRagContext(fused, 4000, 15);
    const sourceMetadata = extractSourcesMetadata(fused);
    const contextBlob = formatContextForPrompt(contextItems, 6000);
    const system = [
        "You are an expert tutoring assistant specializing in academic subjects.",
        `Current subject: ${subjectName || subjectCode || "General"}.`,
        "Provide clear step-by-step explanations using Markdown and LaTeX where useful.",
        "Maintain context across the conversation and ground factual academic claims in the supplied study context.",
        "When referencing past papers, cite the year, paper, page, or question reference when available.",
        "Return the response only through the propose_chat_answer tool.",
        attachments.length > 0
            ? `The student attached: ${attachments.map((item) => item.original_filename).join(", ")}. Acknowledge the files without pretending to have read content that is not included.`
            : "",
        mode === "checker"
            ? "Preserve and explain any AI Checker evaluation context from previous messages."
            : "",
        mode === "mcq_review"
            ? "For every listed MCQ mistake, explain why the selected option is incorrect, identify the correct option, and give a concise teaching point. Do not omit any listed question and do not invent option text that is unavailable."
            : "",
    ].filter(Boolean).join("\n");
    const history = recentMessages
        .slice(-20)
        .filter((message) => ["user", "assistant"].includes(message.role) && message.text)
        .map((message) => ({
            role: message.role,
            content: message.text,
        }));
    const contextualUserText = [
        userText,
        context.syllabusOutline
            ? `Relevant syllabus topics:\n${context.syllabusOutline}`
            : "",
        contextBlob
            ? `Relevant study materials:\n${contextBlob}`
            : "",
        paperContext,
    ].filter(Boolean).join("\n\n---\n");
    const chatMessages = [
        { role: "system", content: system },
        ...history,
        { role: "user", content: contextualUserText },
    ];
    const uploadedFileIds = [];
    const lastUserContent = [{
        type: "input_text",
        text: contextualUserText,
    }];
    if (process.env.GCS_BUCKET_NAME) {
        for (const document of sourceDocuments) {
            if (!document?.gcs_key) continue;
            try {
                const [buffer] = await new Storage()
                    .bucket(process.env.GCS_BUCKET_NAME)
                    .file(document.gcs_key)
                    .download();
                const file = await client.files.create({
                    file: await toFile(
                        buffer,
                        document.title || "source-document.pdf",
                        { type: "application/pdf" }
                    ),
                    purpose: "user_data",
                });
                uploadedFileIds.push(file.id);
                lastUserContent.push({
                    type: "input_text",
                    text: `Attached source document: ${document.title || "document"}`,
                });
                lastUserContent.push({
                    type: "input_file",
                    file_id: file.id,
                });
            } catch {
                // Keep text/RAG fallback usable if a source file is unavailable.
            }
        }
    }
    const input = chatMessages.map((message, index) => ({
        role: message.role,
        content: index === chatMessages.length - 1
            ? lastUserContent
            : [{
                type: message.role === "assistant" ? "output_text" : "input_text",
                text: message.content,
            }],
    }));

    let result;
    try {
        result = await callAssistant({
            client,
            model: getOpenAIModel(),
            input,
            chatMessages,
            mode,
        });
    } finally {
        for (const fileId of uploadedFileIds) {
            try {
                await client.files.delete(fileId);
            } catch {
                // Best-effort cleanup.
            }
        }
    }
    const answer = result.answer || "I couldn't generate a response right now. Please try again in a moment.";
    const sourceById = new Map(
        sourceMetadata.map((source) => [Number(source.chunk_id), source])
    );
    const hydrated = [];
    for (const source of result.toolSources) {
        const chunkId = Number(source.chunk_id);
        const resolved = sourceById.get(chunkId);
        if (resolved) hydrated.push(resolved);
        else if (chunkId > 0) hydrated.push(source);
    }
    for (const chunkId of result.requestedSources) {
        const resolved = sourceById.get(Number(chunkId));
        if (resolved && !hydrated.some((source) => Number(source.chunk_id) === Number(chunkId))) {
            hydrated.push(resolved);
        }
    }
    if (hydrated.length === 0) hydrated.push(...sourceMetadata.slice(0, 15));
    const sources = hydrated.slice(0, Number(process.env.CHAT_MAX_SOURCES || 15))
        .map(formatSource);

    return {
        answer,
        sources,
        chunk_ids: sources.map((source) => source.chunk_id),
        tokens_in: null,
        tokens_out: null,
    };
};
