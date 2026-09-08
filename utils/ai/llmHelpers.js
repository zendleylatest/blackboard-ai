import crypto from "crypto";

export class DeadlineExceeded extends Error {
    constructor(message) {
        super(message);
        this.name = "DeadlineExceeded";
    }
}

const getSlaMs = () => (
    Math.max(1, Number(process.env.GENERATION_SLA_MS || 60000))
);

export const remainingTimeMs = (
    startMs,
    slaMs = getSlaMs()
) => Math.max(0, Math.trunc(slaMs - (Date.now() - startMs)));

export const deadlineGuard = async (
    deadlineMs,
    operation,
    callback
) => {
    const startedAt = Date.now();
    try {
        return await callback();
    } finally {
        const elapsed = Date.now() - startedAt;
        if (elapsed > deadlineMs) {
            throw new DeadlineExceeded(
                `${operation} exceeded ${deadlineMs}ms`
            );
        }
    }
};

const getField = (value, key) => (
    value && typeof value === "object"
        ? value[key]
        : undefined
);

const parseToolArguments = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
};

const findToolCall = (value, toolName) => {
    if (!value || typeof value !== "object") return null;

    const type = getField(value, "type");
    const name = getField(value, "name");
    if (
        ["tool_use", "tool_call", "output_tool_call", "function_call", "function"]
            .includes(type) &&
        name === toolName
    ) {
        return parseToolArguments(
            getField(value, "arguments") || getField(value, "input")
        );
    }

    const functionObject = getField(value, "function");
    if (functionObject) {
        const functionName = getField(functionObject, "name");
        if (functionName === toolName) {
            return parseToolArguments(
                getField(functionObject, "arguments") ||
                getField(functionObject, "input")
            );
        }
    }

    const nestedToolCall = getField(value, "tool_call");
    if (nestedToolCall) {
        const nestedName = getField(nestedToolCall, "name");
        if (nestedName === toolName) {
            return parseToolArguments(
                getField(nestedToolCall, "arguments") ||
                getField(nestedToolCall, "input")
            );
        }
    }

    const callObject = getField(value, "call");
    if (callObject) {
        const callFunction = getField(callObject, "function");
        if (getField(callFunction, "name") === toolName) {
            return parseToolArguments(
                getField(callFunction, "arguments") ||
                getField(callFunction, "input")
            );
        }
    }

    const content = getField(value, "content");
    if (Array.isArray(content)) {
        for (const child of content) {
            const result = findToolCall(child, toolName);
            if (result) return result;
        }
    }

    return null;
};

export const extractToolJson = (response, toolName) => {
    try {
        const choices = getField(response, "choices");
        if (Array.isArray(choices)) {
            for (const choice of choices) {
                const message = getField(choice, "message");
                const toolCalls = getField(message, "tool_calls");
                if (Array.isArray(toolCalls)) {
                    for (const toolCall of toolCalls) {
                        const result = findToolCall(toolCall, toolName);
                        if (result) return result;
                    }
                }

                const content = getField(message, "content");
                if (typeof content === "string") {
                    try {
                        const parsed = JSON.parse(content);
                        if (parsed && typeof parsed === "object") return parsed;
                    } catch {
                        // Continue to the Responses API fallbacks.
                    }
                }
            }
        }

        const output = getField(response, "output");
        if (Array.isArray(output)) {
            for (const block of output) {
                const result = findToolCall(block, toolName);
                if (result) return result;
            }
        }

        if (typeof output === "string") {
            const parsed = parseToolArguments(output);
            if (parsed) return parsed;
        }

        const outputText = getField(response, "output_text");
        if (typeof outputText === "string") {
            const parsed = parseToolArguments(outputText);
            if (parsed) return parsed;
            return { answer: outputText };
        }
    } catch {
        return null;
    }

    return null;
};

export const repairJsonWithLlm = async (
    client,
    invalidOutput,
    schema,
    model,
    timeoutSeconds = 5
) => {
    try {
        const response = await client.chat.completions.create(
            {
                model,
                temperature: 0.1,
                messages: [
                    {
                        role: "system",
                        content: "You are a JSON repair assistant. Return only valid JSON.",
                    },
                    {
                        role: "user",
                        content: [
                            "Convert the following output to valid JSON matching this schema:",
                            JSON.stringify(schema, null, 2),
                            "Invalid output:",
                            String(invalidOutput || "").slice(0, 1000),
                        ].join("\n\n"),
                    },
                ],
            },
            { timeout: timeoutSeconds * 1000 }
        );
        const content = response.choices?.[0]?.message?.content || "";
        try {
            return JSON.parse(content);
        } catch {
            return null;
        }
    } catch {
        return null;
    }
};

export const compressRagContext = (
    items,
    maxTokens = 2600,
    maxItems = 16
) => {
    if (!Array.isArray(items)) return [];
    let currentTokens = 0;
    const output = [];

    for (const item of items.slice(0, maxItems)) {
        const estimate = String(item?.text || "")
            .split(/\s+/)
            .filter(Boolean).length * 1.3;
        if (currentTokens + estimate > maxTokens) break;
        output.push(item);
        currentTokens += estimate;
    }

    return output;
};

const BANNED_TITLE_PREFIXES = [
    "Understanding",
    "Mastering",
    "Exploring",
    "All about",
    "A guide to",
    "Introduction to",
    "Learn about",
    "Study of",
];

export const sanitizeTitle = (
    raw,
    fallback,
    maxLength = 50
) => {
    let title = String(raw || "").trim();
    for (const prefix of BANNED_TITLE_PREFIXES) {
        if (title.toLowerCase().startsWith(prefix.toLowerCase())) {
            title = title
                .replace(new RegExp(`^${prefix}[:\\-\\s]*`, "i"), "")
                .trim();
            break;
        }
    }
    title = title.replace(/\s+/g, " ");
    return (title || String(fallback || ""))
        .slice(0, maxLength)
        .trim();
};

export const computeContentHash = (content) => (
    crypto
        .createHash("md5")
        .update(String(content || "").toLowerCase().replace(/\s+/g, " ").trim())
        .digest("hex")
        .slice(0, 12)
);

export const hasDeicticReferences = (text) => (
    [
        /\bFig\.\s*\d/i,
        /\bfigure\s+\d/i,
        /\bdiagram\s+(shows|above|below)/i,
        /\b(see|refer to|shown in)\s+(Fig\.|figure|diagram)/i,
        /\b(X and Y|the graph|the table)\b/i,
        /\bas shown\b/i,
        /\babove diagram\b/i,
        /\bbelow table\b/i,
    ].some((pattern) => pattern.test(String(text || "")))
);

export const hasMcqStubPattern = (text) => (
    /[A-D]\)\s*[^\n]{1,30}\n[A-D]\)\s*[^\n]{1,30}/i
        .test(String(text || ""))
);

export const filterDeicticChunks = (chunks) => {
    if (!Array.isArray(chunks)) return [[], 0];
    let filteredCount = 0;
    const filtered = chunks.filter((chunk) => {
        const hasFigure = Boolean(chunk?.figure);
        if (
            (hasDeicticReferences(chunk?.text) && !hasFigure) ||
            hasMcqStubPattern(chunk?.text)
        ) {
            filteredCount += 1;
            return false;
        }
        return true;
    });
    return [filtered, filteredCount];
};

const words = (value) => (
    String(value || "")
        .toLowerCase()
        .match(/\w+/g) || []
);

export const assignSourcesToItems = (
    items,
    contextChunks,
    itemTextKeys,
    topK = 2
) => {
    if (!Array.isArray(contextChunks) || contextChunks.length === 0) {
        return [items, Array.isArray(items) ? items.length : 0];
    }

    let missingCount = 0;
    for (const item of Array.isArray(items) ? items : []) {
        if (Array.isArray(item?.sources) && item.sources.length > 0) {
            continue;
        }

        const itemWords = new Set(
            itemTextKeys.flatMap((key) => words(item?.[key]))
        );
        if (itemWords.size === 0) {
            missingCount += 1;
            continue;
        }

        const scores = contextChunks.map((chunk) => {
            const chunkWords = new Set(words(chunk?.text));
            const intersection = [...itemWords]
                .filter((word) => chunkWords.has(word)).length;
            const union = new Set([...itemWords, ...chunkWords]).size;
            return {
                score: union > 0 ? intersection / union : 0,
                chunkId: Number(chunk?.chunk_id || 0),
            };
        });

        item.sources = scores
            .sort((left, right) => right.score - left.score)
            .slice(0, topK)
            .map((entry) => entry.chunkId)
            .filter((id) => id > 0);

        if (item.sources.length === 0) missingCount += 1;
    }

    return [items, missingCount];
};

const extractPaperFromName = (name) => {
    const match = String(name || "")
        .match(/[_-](qp|ms|er)_?(\d)(\d)?/i);
    return match ? `P${match[2]}` : "";
};

export const extractSourcesMetadata = (fusedItems) => (
    (Array.isArray(fusedItems) ? fusedItems : [])
        .filter(Boolean)
        .map((item) => {
            const doc = item.doc || {};
            const qref = String(item.qref || "");
            const match = qref.match(/\b[Qq]?(\d+)/);
            const parsedQuestion = match ? Number(match[1]) : null;
            const questionNum = parsedQuestion && parsedQuestion <= 40
                ? parsedQuestion
                : null;
            return {
                chunk_id: Number(item.chunk_id || 0),
                // Keep a missing doc id as null rather than coercing to 0 -
                // the frontend only treats null as "no PDF to open" and would
                // otherwise try (and fail) to open document id 0.
                doc_id: doc.id ? Number(doc.id) : null,
                page: item.page ?? 0,
                qref: questionNum ? qref : "",
                question_num: questionNum,
                subject_code: doc.subject_code || "",
                year: doc.year ?? "",
                series: doc.series || "",
                document_type: doc.document_type || "",
                paper: doc.paper || extractPaperFromName(doc.name),
                kind: item.kind || "text",
                figure_url: item.figure?.url || null,
            };
        })
);

export const formatContextForPrompt = (
    fusedItems,
    maxLength = 12000
) => {
    const context = (Array.isArray(fusedItems) ? fusedItems : [])
        .filter(Boolean)
        .map((item) => {
            const doc = item.doc || {};
            const location = [
                doc.subject_code,
                doc.year,
                doc.series,
            ].filter((value) => value !== undefined && value !== null && value !== "")
                .join("-");
            const page = item.page ?? "";
            const qref = item.qref ? ` ${item.qref}` : "";
            const header = `[${String(item.kind || "text").toUpperCase()}] ${location}, p${page}${qref}`;
            const text = item.text || item.figure?.caption || "[Image content]";
            return `${header}\n${text}`.trim();
        })
        .join("\n\n");

    return context.length > maxLength
        ? `${context.slice(0, maxLength)}\n[...truncated...]`
        : context;
};
