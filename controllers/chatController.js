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
    const wantsSseEarly = String(req.headers.accept || "")
        .toLowerCase()
        .includes("text/event-stream");
    let heartbeat = null;
    let streamOpened = false;
    const openStream = () => {
        if (streamOpened || res.headersSent) return;
        streamOpened = true;
        res.status(200);
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();
        res.write(": open\n\n");
        heartbeat = setInterval(() => res.write(": ping\n\n"), 10000);
    };
    // Fast failures (plan limit, validation) must still return a real HTTP
    // status, so the stream only opens if the AI is taking a while. Opening
    // it keeps the connection alive; headers used to be sent only after the
    // full answer was ready, so slow generations got dropped with
    // "Connection closed before full header was received".
    const openTimer = wantsSseEarly ? setTimeout(openStream, 2500) : null;
    res.on("close", () => {
        clearTimeout(openTimer);
        clearInterval(heartbeat);
    });
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
            clearTimeout(openTimer);
            clearInterval(heartbeat);
            if (!res.headersSent) {
                res.status(200);
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("Connection", "keep-alive");
                res.setHeader("X-Accel-Buffering", "no");
            }
            res.write(sseFrame("ack", { user: result.user }));
            res.write(sseFrame("delta", { text: result.assistant.text }));
            res.write(sseFrame("final", { assistant: result.assistant }));
            return res.end();
        }
        return res.status(201).json(result);
    } catch (error) {
        clearTimeout(openTimer);
        clearInterval(heartbeat);
        {
            if (res.headersSent) {
                // Headers already went out as a stream: report the failure
                // as an SSE error event instead of an HTTP status.
                res.write(sseFrame("error", {
                    message: error?.statusCode === 429
                        ? error.message
                        : "Something went wrong. Please try again.",
                    status: error?.statusCode || 500,
                }));
                return res.end();
            }
        }
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
