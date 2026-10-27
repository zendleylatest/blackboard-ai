import { toFile } from "openai/uploads";
import HttpError from "../../utils/httpError.js";
import { getOpenAIClient, getOpenAIModel } from "../../utils/ai/openaiClient.js";
import { extractToolJson } from "../../utils/ai/llmHelpers.js";
import { readResourceFile } from "../../utils/localStorage.js";
import { logAiUsage } from "../../utils/ai/aiUsageTracker.js";

const CHECKER_TOOL_SCHEMA = {
    name: "return_marking_json",
    description: "Return strict JSON for the marking result",
    parameters: {
        type: "object",
        properties: {
            question_text: { type: "string" },
            mark_scheme_text: { type: "string" },
            total_marks: { type: "number" },
            marks_awarded: { type: "number" },
            percentage: { type: "number" },
            marking_breakdown: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        criterion: { type: "string" },
                        marks_available: { type: "number" },
                        marks_awarded: { type: "number" },
                        student_response: { type: "string" },
                        mark_scheme_requirement: { type: "string" },
                        met: { type: "boolean" },
                        explanation: { type: "string" },
                    },
                    required: [
                        "criterion",
                        "marks_available",
                        "marks_awarded",
                        "student_response",
                        "mark_scheme_requirement",
                        "met",
                        "explanation",
                    ],
                },
            },
            overall_feedback: { type: "string" },
            strengths: {
                type: "array",
                items: { type: "string" },
            },
            improvements: {
                type: "array",
                items: { type: "string" },
            },
        },
        required: [
            "question_text",
            "mark_scheme_text",
            "total_marks",
            "marks_awarded",
            "percentage",
            "marking_breakdown",
            "overall_feedback",
        ],
    },
};

const imageMimeForDocument = (document) => {
    const declared = String(document?.mime || "").toLowerCase();
    if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(declared)) {
        return declared;
    }
    const extension = String(document?.title || "")
        .toLowerCase()
        .split(".")
        .pop();
    return {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
    }[extension] || null;
};

const normalizeResult = (payload, fallbackQuestion, fallbackMarks) => {
    if (!payload || typeof payload !== "object") {
        throw new HttpError(502, "AI returned invalid evaluation data.");
    }
    const totalMarks = Math.max(
        0,
        Number(payload.total_marks ?? fallbackMarks ?? 0)
    );
    const marksAwarded = Math.min(
        totalMarks,
        Math.max(0, Number(payload.marks_awarded || 0))
    );
    return {
        success: true,
        question_identified: true,
        question_text_from_paper: String(
            payload.question_text || fallbackQuestion || ""
        ),
        mark_scheme_exact_text: String(payload.mark_scheme_text || ""),
        mark_scheme_text: String(payload.mark_scheme_text || ""),
        marks_awarded: marksAwarded,
        max_marks: totalMarks,
        percentage: totalMarks > 0
            ? Number(payload.percentage ?? (marksAwarded / totalMarks) * 100)
            : 0,
        marking_breakdown: Array.isArray(payload.marking_breakdown)
            ? payload.marking_breakdown
            : [],
        feedback: String(payload.overall_feedback || ""),
        strengths: Array.isArray(payload.strengths)
            ? payload.strengths.map(String)
            : [],
        improvements: Array.isArray(payload.improvements)
            ? payload.improvements.map(String)
            : [],
        marking_rubric: {
            criteria: Array.isArray(payload.marking_breakdown)
                ? payload.marking_breakdown
                : [],
            max_marks: totalMarks,
        },
        model_used: getOpenAIModel(),
    };
};

export const evaluateAnswerWithAi = async ({
    question,
    studentAnswer,
    subjectCode = "",
    markSchemeText = "",
    maxMarks = null,
    sourceDocuments = [],
    userId = null,
}) => {
    if (!process.env.OPENAI_API_KEY) {
        throw new HttpError(503, "AI Checker is not configured.");
    }
    const client = getOpenAIClient();
    const startedAt = Date.now();
    const system = [
        "You are a strict but fair Cambridge-style examiner.",
        "Evaluate only what the student actually wrote.",
        markSchemeText
            ? "Follow the supplied mark scheme literally and do not invent additional marking points."
            : "Create a reasonable explicit rubric before awarding marks.",
        "Treat visible work in attached images as part of the student's answer and examine it carefully.",
        "Explain every awarded or deducted mark and return only through the provided function.",
    ].join(" ");
    const user = [
        `Subject: ${subjectCode || "General"}`,
        `Question:\n${question}`,
        `Student answer:\n${studentAnswer}`,
        markSchemeText
            ? `Official mark scheme:\n${markSchemeText}`
            : "No official mark scheme was supplied.",
        maxMarks !== null ? `Maximum marks: ${maxMarks}` : "",
    ].filter(Boolean).join("\n\n");
    const uploadedFileIds = [];
    const userContent = [{ type: "input_text", text: user }];
    const completionUserContent = [{ type: "text", text: user }];
    // Read/upload every source in parallel (they used to go one by one), keeping
    // the original order of the attachments in the prompt.
    const prepared = await Promise.all(sourceDocuments.map(async (document) => {
        if (!document?.gcs_key) return null;
        try {
            const buffer = await readResourceFile(document.gcs_key);
            const imageMime = imageMimeForDocument(document);
            if (imageMime) {
                return {
                    imageUrl: `data:${imageMime};base64,${buffer.toString("base64")}`,
                };
            }
            const file = await client.files.create({
                file: await toFile(
                    buffer,
                    document.title || "document",
                    { type: document.mime || "application/pdf" }
                ),
                purpose: "user_data",
            });
            uploadedFileIds.push(file.id);
            return { fileId: file.id, title: document.title || "document" };
        } catch {
            // Text and metadata remain usable if a source file is unavailable.
            return null;
        }
    }));
    for (const item of prepared) {
        if (!item) continue;
        if (item.imageUrl) {
            userContent.push({
                type: "input_image",
                image_url: item.imageUrl,
                detail: "auto",
            });
            completionUserContent.push({
                type: "image_url",
                image_url: { url: item.imageUrl, detail: "auto" },
            });
        } else {
            userContent.push({
                type: "input_text",
                text: `Attached source document: ${item.title}`,
            });
            userContent.push({ type: "input_file", file_id: item.fileId });
        }
    }
    let response;
    try {
        response = await client.responses.create({
            model: getOpenAIModel(),
            input: [
                {
                    role: "system",
                    content: [{ type: "input_text", text: system }],
                },
                {
                    role: "user",
                    content: userContent,
                },
            ],
            tools: [{
                type: "function",
                name: CHECKER_TOOL_SCHEMA.name,
                description: CHECKER_TOOL_SCHEMA.description,
                parameters: CHECKER_TOOL_SCHEMA.parameters,
            }],
            tool_choice: {
                type: "function",
                name: CHECKER_TOOL_SCHEMA.name,
            },
            temperature: 0.1,
            max_output_tokens: 3000,
        });
    } catch {
        response = await client.chat.completions.create({
            model: getOpenAIModel(),
            messages: [
                { role: "system", content: system },
                { role: "user", content: completionUserContent },
            ],
            tools: [{
                type: "function",
                function: CHECKER_TOOL_SCHEMA,
            }],
            tool_choice: {
                type: "function",
                function: { name: CHECKER_TOOL_SCHEMA.name },
            },
            temperature: 0.1,
            max_tokens: 3000,
        });
    }
    // Cleanup is best effort and must not delay the response.
    for (const fileId of uploadedFileIds) {
        client.files.delete(fileId).catch(() => {});
    }
    const result = normalizeResult(
        extractToolJson(response, CHECKER_TOOL_SCHEMA.name),
        question,
        maxMarks
    );
    result.evaluation_time_seconds = Math.max(
        0,
        Math.round((Date.now() - startedAt) / 1000)
    );
    result.tokens_used = Number(
        response?.usage?.total_tokens ||
        response?.usage?.totalTokens ||
        0
    );
    logAiUsage({
        userId,
        feature: "ai_checker",
        model: getOpenAIModel(),
        response,
    });
    return result;
};
