import HttpError from "../utils/httpError.js";
import { findDocumentById } from "../models/document/Document.js";
import {
    createAICheckerEvaluation,
    findAICheckerEvaluationForUser,
    findAICheckerHistory,
    findMatchingMarkScheme,
    findQuestionMappingsByDocument,
} from "../models/AiChecker.js";
import {
    createChatMessage,
    findChatAttachments,
    findChatThreadById,
    updateChatThreadActivity,
} from "../models/ChatThread.js";
import { serializeChatMessage } from "./chatThreadService.js";
import {
    checkUsageLimit,
    incrementUsage,
} from "./usageLimitService.js";
import { evaluateAnswerWithAi } from "./aiChecker/aiCheckerAiService.js";

// Builds a "Sources" entry (in the same shape RAG chat sources use, so the
// existing SourcesSheet/SourcesButton widgets render it unchanged) for the
// question paper + mark scheme a past-paper evaluation was actually marked
// against, letting the user open the real PDF from the AI Checker's chat
// bubble instead of only having it as an invisible input to the AI call.
const buildCheckerSource = (document, { qref = "" } = {}) => {
    if (!document) return null;
    return {
        chunk_id: 0,
        doc_id: document.id,
        page: null,
        qref,
        subject_code: document.subject_code || "",
        year: document.year || "",
        series: document.series || "",
        document_type: String(document.document_type || "").toLowerCase(),
        paper: document.paper || "",
        variant: document.variant || "",
        doc: {
            id: document.id,
            subject_code: document.subject_code || "",
            year: document.year || "",
            series: document.series || "",
            paper: document.paper || "",
            variant: document.variant || "",
            document_type: String(document.document_type || "").toLowerCase(),
        },
    };
};

const formatEvaluationResponse = (evaluation) => {
    const parts = [
        `**Marks: ${evaluation.marks_awarded}/${evaluation.max_marks} (${Number(evaluation.percentage || 0).toFixed(1)}%)**\n`,
    ];
    if (evaluation.mark_scheme_text) {
        parts.push(`**Mark Scheme:**\n${evaluation.mark_scheme_text}\n`);
    }
    if (evaluation.marking_breakdown.length > 0) {
        parts.push("**Marking Breakdown:**");
        for (const item of evaluation.marking_breakdown) {
            parts.push(
                `- ${item.criterion}: ${item.marks_awarded}/${item.marks_available} — ${item.explanation}`
            );
        }
        parts.push("");
    }
    if (evaluation.feedback) {
        parts.push(`**Overall Feedback:**\n${evaluation.feedback}`);
    }
    return parts.join("\n");
};

const getThreadOrThrow = async (userId, threadId) => {
    const thread = await findChatThreadById(threadId, userId);
    if (!thread) throw new HttpError(404, "Thread not found.");
    return thread;
};

const buildPastPaperContext = async ({
    questionPaperId,
    questionNumber,
    questionPart,
    questionSubpart,
}) => {
    const questionPaper = await findDocumentById(questionPaperId);
    if (!questionPaper) throw new HttpError(404, "Question paper not found.");
    const markScheme = await findMatchingMarkScheme(questionPaper);
    if (!markScheme) {
        throw new HttpError(
            404,
            `No matching mark scheme found for ${questionPaper.title}.`
        );
    }
    let mappings = await findQuestionMappingsByDocument(
        questionPaper.id,
        questionNumber,
        questionPart,
        questionSubpart
    );
    if (mappings.length === 0) {
        mappings = await findQuestionMappingsByDocument(
            markScheme.id,
            questionNumber,
            questionPart,
            questionSubpart
        );
    }
    const markSchemeText = mappings
        .map((mapping) => mapping.mark_scheme_text)
        .filter(Boolean)
        .join("\n");
    const maxMarks = mappings.length > 0
        ? mappings.reduce(
            (total, mapping) => total + Number(mapping.max_marks || 0),
            0
        )
        : null;
    const reference = `Q${questionNumber}${questionPart ? `(${questionPart})` : ""}${questionSubpart ? `(${questionSubpart})` : ""}`;
    return {
        questionPaper,
        markScheme,
        question: `${questionPaper.title} — ${reference}`,
        markSchemeText,
        maxMarks,
    };
};

export const evaluateWithAiChecker = async (
    userId,
    threadId,
    payload
) => {
    const thread = await getThreadOrThrow(userId, threadId);
    const mode = payload.mode === "general" ? "general" : "past_paper";
    const studentAnswer = String(payload.studentAnswer || "").trim();
    if (!studentAnswer) {
        throw new HttpError(400, "Student answer is required.");
    }
    const feature = mode === "past_paper"
        ? "past_paper_questions"
        : "ai_checker";
    const usage = await checkUsageLimit(userId, feature);
    if (!usage.allowed) throw new HttpError(429, usage.message);
    await incrementUsage(userId, feature);

    let question;
    let context = null;
    const threadAttachments = await findChatAttachments(
        threadId,
        userId
    );
    const attachmentIds = new Set(
        (Array.isArray(payload.attachmentIds) ? payload.attachmentIds : [])
            .map((id) => String(id).replace(/-/g, "").toLowerCase())
    );
    const uploadedAttachments = threadAttachments.filter((attachment) => (
        attachmentIds.has(String(attachment.id).replace(/-/g, "").toLowerCase())
    ));
    if (mode === "general") {
        question = String(payload.question || "").trim();
        if (!question) {
            throw new HttpError(
                400,
                "Question text is required for general mode."
            );
        }
    } else {
        if (!payload.questionPaperId) {
            throw new HttpError(
                400,
                "Question paper ID is required for past paper mode."
            );
        }
        if (!String(payload.questionNumber || "").trim()) {
            throw new HttpError(
                400,
                "Question number is required for past paper mode."
            );
        }
        context = await buildPastPaperContext({
            questionPaperId: payload.questionPaperId,
            questionNumber: String(payload.questionNumber).trim(),
            questionPart: String(payload.questionPart || "").trim(),
            questionSubpart: String(payload.questionSubpart || "").trim(),
        });
        question = context.question;
    }

    const result = await evaluateAnswerWithAi({
        question,
        studentAnswer,
        subjectCode: thread.subject_code || "",
        markSchemeText: context?.markSchemeText || "",
        maxMarks: context?.maxMarks,
        userId,
        sourceDocuments: [
            ...(context
                ? [context.questionPaper, context.markScheme]
                : []),
            ...uploadedAttachments.map((attachment) => ({
                title: attachment.original_filename,
                gcs_key: attachment.gcs_key,
                mime: attachment.mime,
            })),
        ],
    });
    const questionNumber = mode === "past_paper"
        ? String(payload.questionNumber).trim()
        : "";
    const questionPart = mode === "past_paper"
        ? String(payload.questionPart || "").trim()
        : "";
    const questionSubpart = mode === "past_paper"
        ? String(payload.questionSubpart || "").trim()
        : "";
    const messageText = mode === "general"
        ? `Question: ${question}\n\nAnswer: ${studentAnswer}`
        : `Past Paper: ${context.questionPaper.title} - Q${questionNumber}${questionPart ? `(${questionPart})` : ""}${questionSubpart ? `(${questionSubpart})` : ""}\n\nAnswer: ${studentAnswer}`;
    const userMessage = await createChatMessage({
        threadId,
        role: "user",
        mode: "checker",
        text: messageText,
        metadata: mode === "general"
            ? {
                evaluation_mode: "general",
                question_text: question,
            }
            : {
                evaluation_mode: "past_paper",
                question_paper_id: context.questionPaper.id,
                mark_scheme_id: context.markScheme.id,
                question_number: questionNumber,
                question_part: questionPart,
                question_subpart: questionSubpart,
            },
    });
    const evaluation = await createAICheckerEvaluation({
        threadId,
        messageId: userMessage.id,
        mode,
        questionText: result.question_text_from_paper || question,
        studentAnswer,
        questionPaperId: context?.questionPaper.id || null,
        questionNumber,
        questionPart,
        questionSubpart,
        marksAwarded: result.marks_awarded,
        maxMarks: result.max_marks,
        markingRubric: result.marking_rubric,
        feedback: result.feedback,
        strengths: result.strengths,
        improvements: result.improvements,
        modelUsed: result.model_used,
        evaluationTimeSeconds: result.evaluation_time_seconds,
    });
    const qref = mode === "past_paper"
        ? `Q${questionNumber}${questionPart ? `(${questionPart})` : ""}${questionSubpart ? `(${questionSubpart})` : ""}`
        : "";
    const checkerSources = mode === "past_paper"
        ? [
            buildCheckerSource(context.questionPaper, { qref }),
            buildCheckerSource(context.markScheme, { qref }),
        ].filter(Boolean)
        : [];

    const assistantMessage = await createChatMessage({
        threadId,
        role: "assistant",
        mode: "checker",
        text: formatEvaluationResponse(result),
        sources: checkerSources,
        metadata: {
            evaluation_id: evaluation.id,
            marks_awarded: result.marks_awarded,
            max_marks: result.max_marks,
            percentage: result.percentage,
            tokens_used: result.tokens_used,
        },
    });
    await updateChatThreadActivity(threadId, {
        preview: `AI Checker: ${result.marks_awarded}/${result.max_marks} (${Number(result.percentage || 0).toFixed(0)}%)`,
        lastMessageAt: new Date(),
    });

    return {
        success: true,
        evaluation: {
            id: evaluation.id,
            question_identified: result.question_identified,
            question_text_from_paper: result.question_text_from_paper,
            mark_scheme_exact_text: result.mark_scheme_exact_text,
            marks_awarded: result.marks_awarded,
            max_marks: result.max_marks,
            percentage: result.percentage,
            marking_breakdown: result.marking_breakdown,
            feedback: result.feedback,
            strengths: result.strengths,
            improvements: result.improvements,
            model_used: result.model_used,
            evaluation_time_seconds: result.evaluation_time_seconds,
            tokens_used: result.tokens_used,
        },
        messages: {
            user: serializeChatMessage(userMessage),
            assistant: serializeChatMessage(assistantMessage),
        },
    };
};

export const getAiCheckerHistory = async (userId, threadId) => {
    await getThreadOrThrow(userId, threadId);
    return {
        success: true,
        evaluations: await findAICheckerHistory(threadId),
    };
};

export const getAiCheckerEvaluation = async (userId, evaluationId) => {
    const evaluation = await findAICheckerEvaluationForUser(
        evaluationId,
        userId
    );
    if (!evaluation) {
        throw new HttpError(404, "Evaluation not found.");
    }
    return { success: true, evaluation };
};

export const getQuestionMappings = async (documentId) => {
    const document = await findDocumentById(documentId);
    if (!document) throw new HttpError(404, "Document not found.");
    const mappings = await findQuestionMappingsByDocument(documentId);
    return {
        success: true,
        document: {
            id: document.id,
            title: document.title,
            year: document.year,
            document_type: document.document_type,
        },
        question_mappings: mappings.map((mapping) => ({
            id: mapping.id,
            question_number: mapping.question_number,
            question_part: mapping.question_part,
            question_subpart: mapping.question_subpart,
            max_marks: Number(mapping.max_marks || 0),
            mark_scheme_text: String(mapping.mark_scheme_text || "").length > 100
                ? `${String(mapping.mark_scheme_text).slice(0, 100)}...`
                : mapping.mark_scheme_text || "",
        })),
    };
};
