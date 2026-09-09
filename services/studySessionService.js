import crypto from "crypto";
import HttpError from "../utils/httpError.js";
import {
    sanitizeStorageFilename,
    writeResourceFile,
} from "../utils/localStorage.js";
import { findDocumentById } from "../models/document/Document.js";
import { findSubjectById } from "../models/ChatThread.js";
import { findQuestionMappingsByDocument } from "../models/AiChecker.js";
import {
    createQuestionAnswer,
    createQuestionAnswerAttachment,
    createQuestionChatMessage,
    createQuestionEvaluation,
    createStudySession,
    deleteStudySession,
    findLatestAnswer,
    findQuestionChatHistory,
    findSessionQuestion,
    findSessionQuestionDetail,
    findStudySession,
    findStudySessions,
    formatUuid,
    iso,
    parseJson,
    serializeSessionDetail,
    updateSessionProgress,
    updateStudySessionExtraction,
} from "../models/StudySession.js";
import {
    checkSessionQuestionLimit,
    checkUsageLimit,
    incrementSessionQuestionUsage,
    incrementUsage,
} from "./usageLimitService.js";
import {
    evaluateStudyQuestion,
    extractQuestionsFromDocuments,
    generateStudyFollowup,
} from "./studySession/studySessionAiService.js";

const getSessionOrThrow = async (userId, sessionId) => {
    const session = await findStudySession(sessionId, userId);
    if (!session) throw new HttpError(404, "Study session not found.");
    return session;
};

const getQuestionOrThrow = async (userId, sessionId, questionId) => {
    const question = await findSessionQuestion(sessionId, questionId, userId);
    if (!question) throw new HttpError(404, "Session or question not found.");
    return question;
};

export const listUserStudySessions = async (
    userId,
    filters = {}
) => findStudySessions(userId, filters);

export const createUserStudySession = async (
    userId,
    {
        questionPaperId,
        markSchemeId,
        subjectId = null,
    }
) => {
    const usage = await checkUsageLimit(userId, "study_sessions");
    if (!usage.allowed) throw new HttpError(429, usage.message);
    const questionPaper = await findDocumentById(questionPaperId);
    const markScheme = await findDocumentById(markSchemeId);
    if (!questionPaper || !markScheme) {
        throw new HttpError(404, "Document not found.");
    }
    const subject = subjectId
        ? await findSubjectById(subjectId)
        : {
            id: questionPaper.subject_id,
            code: questionPaper.subject_code,
        };
    if (!subject) throw new HttpError(404, "Subject not found.");
    const title = [
        subject.code,
        questionPaper.paper ? `P${questionPaper.paper}` : "",
        questionPaper.year,
        questionPaper.series,
    ].filter(Boolean).join(" ") || String(questionPaper.title || "").slice(0, 50);
    const session = await createStudySession({
        userId,
        subjectId: subject.id,
        questionPaperId,
        markSchemeId,
        title,
    });
    try {
        const extraction = await extractQuestionsFromDocuments({
            questionPaper,
            markScheme,
        });
        const questions = extraction.questions || [];
        const questionsData = {
            questions,
            paper_title: extraction.paper_title || "",
            total_marks: extraction.total_marks || 0,
            extraction_time: extraction.processing_time_seconds || 0,
            extraction_model: extraction.extraction_model || "",
        };
        await updateStudySessionExtraction(
            session.id,
            userId,
            questionsData,
            questions
        );
        await incrementUsage(userId, "study_sessions");
        return serializeSessionDetail(
            await findStudySession(session.id, userId)
        );
    } catch (error) {
        await deleteStudySession(session.id, userId);
        throw error;
    }
};

export const getUserStudySession = async (userId, sessionId) => (
    serializeSessionDetail(await getSessionOrThrow(userId, sessionId))
);

export const deleteUserStudySession = async (userId, sessionId) => {
    await getSessionOrThrow(userId, sessionId);
    await deleteStudySession(sessionId, userId);
    return { success: true };
};

export const getUserSessionQuestion = async (
    userId,
    sessionId,
    questionId
) => {
    const question = await findSessionQuestionDetail(
        sessionId,
        questionId,
        userId
    );
    if (!question) throw new HttpError(404, "Session or question not found.");
    return question;
};

export const submitSessionQuestionAnswer = async (
    userId,
    sessionId,
    questionId,
    {
        answerText = "",
        attachments = [],
    }
) => {
    const session = await getSessionOrThrow(userId, sessionId);
    const question = await getQuestionOrThrow(userId, sessionId, questionId);
    if (!String(answerText).trim() && (!Array.isArray(attachments) || attachments.length === 0)) {
        throw new HttpError(400, "Answer text or attachments required.");
    }
    const limit = await checkSessionQuestionLimit(
        userId,
        questionId,
        "answer_revisions"
    );
    if (!limit.allowed) throw new HttpError(429, limit.message);
    await incrementSessionQuestionUsage(questionId, "answer_revisions");
    const existingDetail = await findSessionQuestionDetail(
        sessionId,
        questionId,
        userId
    );
    const nextRevision = Math.max(
        0,
        ...existingDetail.answers.map((answer) => Number(answer.revision_number || 0))
    ) + 1;
    const answerId = await createQuestionAnswer({
        questionId,
        answerText: String(answerText || ""),
        revisionNumber: nextRevision,
    });
    for (const attachment of Array.isArray(attachments) ? attachments : []) {
        await createQuestionAnswerAttachment({
            answerId,
            gcsKey: attachment.gcs_key || "",
            originalFilename: attachment.filename || "attachment",
            kind: attachment.kind || "document",
            sizeBytes: Number(attachment.size_bytes || 0),
        });
    }
    let mappings = await findQuestionMappingsByDocument(
        session.ms_id,
        question.question_number,
        question.question_part,
        question.question_subpart
    );
    if (mappings.length === 0) {
        mappings = await findQuestionMappingsByDocument(
            session.qp_id,
            question.question_number,
            question.question_part,
            question.question_subpart
        );
    }
    const evaluation = await evaluateStudyQuestion({
        questionText: question.question_text,
        questionNumber: question.question_number,
        questionPart: question.question_part,
        questionSubpart: question.question_subpart,
        marksAvailable: question.marks_available,
        studentAnswer: String(answerText || "[See attached document]"),
        markSchemeText: mappings.map((mapping) => mapping.mark_scheme_text).join("\n"),
        subjectCode: session.subject_code,
        sourceDocuments: [
            await findDocumentById(session.qp_id),
            await findDocumentById(session.ms_id),
            ...attachments.map((attachment) => ({
                title: attachment.filename || "student attachment",
                gcs_key: attachment.gcs_key,
                mime: attachment.mime,
            })),
        ],
    });
    await createQuestionEvaluation({
        answerId,
        marksAwarded: evaluation.marks_awarded,
        maxMarks: evaluation.max_marks,
        percentage: evaluation.percentage,
        markingBreakdown: evaluation.marking_breakdown,
        feedback: evaluation.feedback,
        markSchemeText: evaluation.mark_scheme_text,
        questionText: evaluation.question_text_from_paper,
        modelUsed: evaluation.model_used,
        evaluationTimeSeconds: evaluation.evaluation_time_seconds,
        tokensUsed: { total: evaluation.tokens_used || 0 },
    });
    await updateSessionProgress(sessionId, userId);
    const updatedQuestion = await findSessionQuestionDetail(
        sessionId,
        questionId,
        userId
    );
    const updatedSession = await findStudySession(sessionId, userId);
    return {
        success: true,
        answer: updatedQuestion.answers.find(
            (answer) => answer.id === formatUuid(answerId)
        ),
        session_progress: {
            questions_answered: Number(updatedSession.questions_answered || 0),
            total_questions: Number(updatedSession.total_questions || 0),
            total_marks_earned: Number(updatedSession.total_marks_earned || 0),
            total_marks_available: Number(updatedSession.total_marks_available || 0),
        },
    };
};

const serializeQuestionChat = (message) => ({
    id: formatUuid(message.id),
    role: message.role,
    text: message.text,
    sources: parseJson(message.sources, []),
    created_at: iso(message.created_at),
});

export const sendSessionQuestionFollowup = async (
    userId,
    sessionId,
    questionId,
    message
) => {
    const session = await getSessionOrThrow(userId, sessionId);
    const question = await getQuestionOrThrow(userId, sessionId, questionId);
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) throw new HttpError(400, "Message required.");
    const limit = await checkSessionQuestionLimit(
        userId,
        questionId,
        "followup_messages"
    );
    if (!limit.allowed) throw new HttpError(429, limit.message);
    await incrementSessionQuestionUsage(questionId, "followup_messages");
    const latestAnswer = await findLatestAnswer(questionId);
    const history = await findQuestionChatHistory(questionId);
    const userChat = await createQuestionChatMessage({
        questionId,
        role: "user",
        text: cleanMessage,
        relatedAnswerId: latestAnswer?.id || null,
    });
    let mappings = await findQuestionMappingsByDocument(
        session.ms_id,
        question.question_number,
        question.question_part,
        question.question_subpart
    );
    const response = await generateStudyFollowup({
        questionRef: `Q${question.question_number}${question.question_part ? `(${question.question_part})` : ""}${question.question_subpart ? `(${question.question_subpart})` : ""}`,
        questionText: question.question_text,
        studentAnswer: latestAnswer?.answer_text || "",
        evaluationFeedback: latestAnswer?.evaluation_feedback || "",
        chatHistory: history,
        userMessage: cleanMessage,
        markSchemeText: mappings.map((mapping) => mapping.mark_scheme_text).join("\n"),
    });
    const assistantChat = await createQuestionChatMessage({
        questionId,
        role: "assistant",
        text: response.response,
        relatedAnswerId: latestAnswer?.id || null,
    });
    return {
        success: true,
        user_message: serializeQuestionChat(userChat),
        assistant_message: serializeQuestionChat(assistantChat),
    };
};

export const getSessionQuestionChatHistory = async (
    userId,
    sessionId,
    questionId
) => {
    await getQuestionOrThrow(userId, sessionId, questionId);
    return (await findQuestionChatHistory(questionId)).map(serializeQuestionChat);
};

export const completeUserStudySession = async (userId, sessionId) => {
    await getSessionOrThrow(userId, sessionId);
    await updateSessionProgress(sessionId, userId, true);
    return {
        success: true,
        session: await getUserStudySession(userId, sessionId),
    };
};

const classifyFile = (file) => {
    const extension = String(file.originalname || "").toLowerCase().split(".").pop();
    if (String(file.mimetype || "").startsWith("image/") ||
        ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(extension)) {
        return "image";
    }
    if (extension === "pdf" || file.mimetype === "application/pdf") return "pdf";
    return "document";
};

export const uploadStudySessionAttachment = async (
    userId,
    sessionId,
    file
) => {
    await getSessionOrThrow(userId, sessionId);
    if (!file) throw new HttpError(400, "file is required");
    const filename = sanitizeStorageFilename(file.originalname, "attachment");
    const key = `study_session_temp/${String(sessionId).replace(/-/g, "")}/${crypto.randomUUID().slice(0, 8)}_${filename}`;
    await writeResourceFile(key, file.buffer);
    return {
        gcs_key: key,
        filename: file.originalname,
        kind: classifyFile(file),
        size_bytes: file.size || file.buffer.length,
        mime: file.mimetype || "application/octet-stream",
    };
};
