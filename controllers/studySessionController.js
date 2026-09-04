import {
    completeUserStudySession,
    createUserStudySession,
    deleteUserStudySession,
    getSessionQuestionChatHistory,
    getUserSessionQuestion,
    getUserStudySession,
    listUserStudySessions,
    sendSessionQuestionFollowup,
    submitSessionQuestionAnswer,
    uploadStudySessionAttachment,
} from "../services/studySessionService.js";
import {
    getSessionQuestionUsage,
    getUsageLimitSnapshot,
} from "../services/usageLimitService.js";

const sse = (event, payload) => (
    `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
);

export const listStudySessionsController = async (req, res, next) => {
    try {
        return res.status(200).json(await listUserStudySessions(req.user.id, {
            subjectId: req.query.subject_id,
            status: req.query.status,
        }));
    } catch (error) {
        return next(error);
    }
};

export const createStudySessionController = async (req, res, next) => {
    try {
        return res.status(201).json(
            await createUserStudySession(req.user.id, {
                questionPaperId: req.body.question_paper_id,
                markSchemeId: req.body.mark_scheme_id,
                subjectId: req.body.subject_id,
            })
        );
    } catch (error) {
        return next(error);
    }
};

export const getStudySessionController = async (req, res, next) => {
    try {
        return res.status(200).json(
            await getUserStudySession(req.user.id, req.params.session_id)
        );
    } catch (error) {
        return next(error);
    }
};

export const deleteStudySessionController = async (req, res, next) => {
    try {
        return res.status(200).json(
            await deleteUserStudySession(req.user.id, req.params.session_id)
        );
    } catch (error) {
        return next(error);
    }
};

export const getSessionQuestionController = async (req, res, next) => {
    try {
        return res.status(200).json(
            await getUserSessionQuestion(
                req.user.id,
                req.params.session_id,
                req.params.question_id
            )
        );
    } catch (error) {
        return next(error);
    }
};

export const submitQuestionAnswerController = async (req, res, next) => {
    try {
        return res.status(200).json(
            await submitSessionQuestionAnswer(
                req.user.id,
                req.params.session_id,
                req.params.question_id,
                {
                    answerText: req.body.answer_text,
                    attachments: req.body.attachments,
                }
            )
        );
    } catch (error) {
        return next(error);
    }
};

export const sendFollowupChatController = async (req, res, next) => {
    try {
        const result = await sendSessionQuestionFollowup(
            req.user.id,
            req.params.session_id,
            req.params.question_id,
            req.body.message
        );
        const wantsSse = String(req.headers.accept || "")
            .toLowerCase()
            .includes("text/event-stream");
        if (wantsSse) {
            res.status(200);
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.write(sse("ack", { user: result.user_message }));
            res.write(sse("delta", { text: result.assistant_message.text }));
            res.write(sse("final", { assistant: result.assistant_message }));
            return res.end();
        }
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

export const getQuestionChatHistoryController = async (req, res, next) => {
    try {
        return res.status(200).json(
            await getSessionQuestionChatHistory(
                req.user.id,
                req.params.session_id,
                req.params.question_id
            )
        );
    } catch (error) {
        return next(error);
    }
};

export const completeStudySessionController = async (req, res, next) => {
    try {
        return res.status(200).json(
            await completeUserStudySession(req.user.id, req.params.session_id)
        );
    } catch (error) {
        return next(error);
    }
};

export const uploadStudySessionAttachmentController = async (
    req,
    res,
    next
) => {
    try {
        return res.status(200).json(
            await uploadStudySessionAttachment(
                req.user.id,
                req.params.session_id,
                req.file
            )
        );
    } catch (error) {
        return next(error);
    }
};

export const getUsageLimitsController = async (req, res, next) => {
    try {
        return res.status(200).json(
            await getUsageLimitSnapshot(req.user.id)
        );
    } catch (error) {
        return next(error);
    }
};

export const getSessionQuestionUsageController = async (req, res, next) => {
    try {
        await getUserSessionQuestion(
            req.user.id,
            req.params.session_id,
            req.params.question_id
        );
        return res.status(200).json(
            await getSessionQuestionUsage(req.params.question_id)
        );
    } catch (error) {
        return next(error);
    }
};
