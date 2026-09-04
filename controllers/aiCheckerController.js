import {
    evaluateWithAiChecker,
    getAiCheckerEvaluation,
    getAiCheckerHistory,
    getQuestionMappings,
} from "../services/aiCheckerService.js";

const sse = (event, payload) => (
    `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
);

const payloadFromRequest = (req) => ({
    mode: req.body.mode,
    question: req.body.question,
    studentAnswer: req.body.student_answer,
    questionPaperId: req.body.question_paper_id,
    questionNumber: req.body.question_number,
    questionPart: req.body.question_part,
    questionSubpart: req.body.question_subpart,
    attachmentIds: req.body.attachment_ids,
});

export const submitAiCheckerEvaluationController = async (req, res, next) => {
    try {
        const result = await evaluateWithAiChecker(
            req.user.id,
            req.params.thread_id,
            payloadFromRequest(req)
        );
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
};

export const submitAiCheckerEvaluationStreamController = async (
    req,
    res,
    next
) => {
    try {
        const result = await evaluateWithAiChecker(
            req.user.id,
            req.params.thread_id,
            payloadFromRequest(req)
        );
        res.status(200);
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.write(sse("ack", { user: result.messages.user }));
        if (result.messages.assistant?.text) {
            res.write(sse("delta", { text: result.messages.assistant.text }));
        }
        res.write(sse("final", {
            assistant: result.messages.assistant,
            evaluation: result.evaluation,
        }));
        return res.end();
    } catch (error) {
        return next(error);
    }
};

export const getAiCheckerHistoryController = async (req, res, next) => {
    try {
        return res.status(200).json(
            await getAiCheckerHistory(req.user.id, req.params.thread_id)
        );
    } catch (error) {
        return next(error);
    }
};

export const getAiCheckerEvaluationController = async (req, res, next) => {
    try {
        return res.status(200).json(
            await getAiCheckerEvaluation(req.user.id, req.params.evaluation_id)
        );
    } catch (error) {
        return next(error);
    }
};

export const getQuestionMappingsController = async (req, res, next) => {
    try {
        return res.status(200).json(
            await getQuestionMappings(req.params.document_id)
        );
    } catch (error) {
        return next(error);
    }
};

