import {
    downloadChatAttachment,
    listChatAttachments,
    sendChatMessage,
    uploadChatAttachment,
    submitMcqWrongReview,
} from "../services/chatService.js";

const sseFrame = (event, payload) => (
    `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
);

export const sendChatMessageController = async (req, res, next) => {
    try {
        const result = await sendChatMessage(
            req.user.id,
            req.params.thread_id,
            {
                text: req.body.text,
                mode: req.body.mode,
                attachmentIds: req.body.attachment_ids,
                overrideGating: req.body.override_gating,
                paperDocumentId: req.body.paper_document_id,
            }
        );
        const wantsSse = String(req.headers.accept || "")
            .toLowerCase()
            .includes("text/event-stream");
        if (wantsSse) {
            res.status(200);
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("X-Accel-Buffering", "no");
            res.write(sseFrame("ack", { user: result.user }));
            res.write(sseFrame("delta", { text: result.assistant.text }));
            res.write(sseFrame("final", { assistant: result.assistant }));
            return res.end();
        }
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
};

export const submitMcqWrongReviewController = async (req, res, next) => {
    try {
        const result = await submitMcqWrongReview(
            req.user.id,
            req.params.thread_id,
            {
                questionPaperId: req.body.question_paper_id,
                wrongAnswers: req.body.wrong_answers,
            }
        );
        const wantsSse = String(req.headers.accept || "")
            .toLowerCase()
            .includes("text/event-stream");
        if (wantsSse) {
            res.status(200);
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("X-Accel-Buffering", "no");
            res.write(sseFrame("ack", { user: result.user }));
            if (result.mark_scheme_missing) {
                res.write(sseFrame("info", {
                    message: "Mark scheme not found for this paper. Proceeding with the question paper and answer key.",
                }));
            }
            res.write(sseFrame("delta", { text: result.assistant.text }));
            res.write(sseFrame("final", { assistant: result.assistant }));
            return res.end();
        }
        return res.status(201).json({
            user: result.user,
            assistant: result.assistant,
        });
    } catch (error) {
        next(error);
    }
};

export const listChatAttachmentsController = async (req, res, next) => {
    try {
        const attachments = await listChatAttachments(
            req.user.id,
            req.params.thread_id
        );
        return res.status(200).json(attachments);
    } catch (error) {
        return next(error);
    }
};

export const uploadChatAttachmentController = async (req, res, next) => {
    try {
        const attachment = await uploadChatAttachment(
            req.user.id,
            req.params.thread_id,
            req.file
        );
        return res.status(201).json(attachment);
    } catch (error) {
        return next(error);
    }
};

export const downloadChatAttachmentController = async (req, res, next) => {
    try {
        const file = await downloadChatAttachment(
            req.user.id,
            req.params.thread_id,
            req.params.att_id
        );
        const disposition = file.inline ? "inline" : "attachment";
        const safeName = file.filename.replace(/["\r\n]/g, "_");
        res.setHeader("Content-Type", file.mime);
        res.setHeader(
            "Content-Disposition",
            `${disposition}; filename="${safeName}"`
        );
        res.setHeader("Cache-Control", "private, max-age=600");
        return res.status(200).send(file.buffer);
    } catch (error) {
        return next(error);
    }
};
