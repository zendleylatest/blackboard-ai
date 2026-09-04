import { Storage } from "@google-cloud/storage";
import crypto from "crypto";
import HttpError from "../utils/httpError.js";
import {
    checkUsageLimit,
    incrementUsage,
} from "./usageLimitService.js";
import {
    createChatMessage,
    createChatAttachment,
    findChatAttachmentById,
    findChatAttachments,
    findChatMessagesByThread,
    findChatThreadById,
    linkChatAttachmentsToMessage,
    updateChatThreadActivity,
    updateChatAttachment,
} from "../models/ChatThread.js";
import {
    generateChatTitle,
    serializeChatAttachment,
    serializeChatMessage,
} from "./chatThreadService.js";
import {
    findDocumentById,
    findMcqReviewDocuments,
} from "../models/document/Document.js";
import { generateChatAssistantResponse } from "./chat/chatAiService.js";

const getStorage = () => {
    if (!process.env.GCS_BUCKET_NAME) return null;
    return new Storage();
};

const parseJson = (value, fallback) => {
    if (value && typeof value === "object") return value;
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
};

const classifyAttachment = (filename, mime) => {
    const extension = String(filename || "").toLowerCase().split(".").pop();
    if (String(mime || "").startsWith("image/") ||
        ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(extension)) {
        return "image";
    }
    if (extension === "pdf" || mime === "application/pdf") return "pdf";
    if (["doc", "docx"].includes(extension)) return "docx";
    if (extension === "txt" || mime === "text/plain") return "txt";
    if (["md", "markdown"].includes(extension)) return "md";
    if (["rtf"].includes(extension)) return "rtf";
    if (["html", "htm"].includes(extension)) return "html";
    return "other";
};

const getPaperContext = async (documentId) => {
    if (!documentId) return "";
    try {
        const document = await findDocumentById(documentId);
        if (!document?.gcs_key || !process.env.GCS_BUCKET_NAME) return "";
        const storage = getStorage();
        const [buffer] = await storage
            .bucket(process.env.GCS_BUCKET_NAME)
            .file(document.gcs_key)
            .download();
        const text = buffer.toString("utf8").slice(0, 25000);
        return `Referenced past paper: ${document.title || "Past Paper"}\n${text}`;
    } catch {
        return "";
    }
};

const getThreadOrThrow = async (userId, threadId) => {
    const thread = await findChatThreadById(threadId, userId);
    if (!thread) throw new HttpError(404, "Chat thread not found.");
    return thread;
};

export const sendChatMessage = async (
    userId,
    threadId,
    {
        text,
        mode = "assistant",
        attachmentIds = [],
        overrideGating = false,
        paperDocumentId = null,
    }
) => {
    const thread = await getThreadOrThrow(userId, threadId);
    const cleanText = String(text || "").trim();
    if (!cleanText) throw new HttpError(400, "text required");

    const usage = await checkUsageLimit(userId, "chat_messages");
    if (!usage.allowed) throw new HttpError(429, usage.message);
    await incrementUsage(userId, "chat_messages");

    const userMessage = await createChatMessage({
        threadId,
        role: "user",
        mode: String(mode || "assistant").trim(),
        text: cleanText,
    });
    await linkChatAttachmentsToMessage(
        attachmentIds,
        threadId,
        userId,
        userMessage.id
    );

    const attachments = [];
    for (const id of Array.isArray(attachmentIds) ? attachmentIds : []) {
        const attachment = await findChatAttachmentById(id, threadId, userId);
        if (attachment) attachments.push(attachment);
    }
    const allMessages = await findChatMessagesByThread(threadId);
    const recentMessages = allMessages.slice(-20).map((message) => ({
        role: message.role,
        text: message.text || "",
        mode: message.mode || "assistant",
        has_attachments: attachments.some((item) => item.message_id === message.id),
        metadata: parseJson(message.metadata, {}),
        sources: parseJson(message.sources, []),
    }));

    let response;
    let assistantError = "";
    try {
        response = await generateChatAssistantResponse({
            subjectCode: thread.subject_code || "",
            subjectName: thread.subject_name || "",
            userText: cleanText,
            recentMessages,
            mode,
            overrideGating: Boolean(overrideGating),
            attachments,
            paperContext: await getPaperContext(paperDocumentId),
        });
    } catch (error) {
        assistantError = error.message || "assistant_generation_failed";
        console.error(
            `[CHAT] Assistant generation failed thread=${threadId} user=${userId}: ${error?.code || ""} ${error?.status || ""} ${error?.message || error}`
        );
        response = {
            answer: process.env.NODE_ENV === "production"
                ? "I couldn't generate a response right now. Please try again in a moment."
                : `Dev fallback: I received "${cleanText}". AI generation failed on the backend (${assistantError}).`,
            sources: [],
            chunk_ids: [],
        };
    }

    const metadata = {};
    if (assistantError) metadata.error = assistantError;
    for (const key of [
        "subject_mismatch",
        "suggested_subject",
        "current_subject",
        "current_subject_code",
        "reasoning",
    ]) {
        if (response[key] !== undefined) metadata[key] = response[key];
    }
    const assistantMessage = await createChatMessage({
        threadId,
        role: "assistant",
        mode: String(mode || "assistant").trim(),
        text: response.answer,
        tokensIn: response.tokens_in,
        tokensOut: response.tokens_out,
        modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
        chunkIds: response.chunk_ids || [],
        sources: response.sources || [],
        metadata,
    });
    const title = thread.title?.trim()
        ? undefined
        : generateChatTitle(cleanText, thread.subject_code || "");
    await updateChatThreadActivity(threadId, {
        title,
        preview: assistantMessage.text,
        lastMessageAt: new Date(),
    });

    const linkedAttachments = await findChatAttachments(
        threadId,
        userId,
        userMessage.id
    );
    return {
        user: serializeChatMessage(userMessage, linkedAttachments),
        assistant: serializeChatMessage(assistantMessage),
    };
};

export const submitMcqWrongReview = async (
    userId,
    threadId,
    {
        questionPaperId,
        wrongAnswers,
    }
) => {
    const thread = await getThreadOrThrow(userId, threadId);
    const usage = await checkUsageLimit(userId, "mcq_wrong_reviews");
    if (!usage.allowed) {
        throw new HttpError(429, usage.message);
    }

    const {
        questionPaper,
        answerKey,
        markScheme,
    } = await findMcqReviewDocuments(questionPaperId);
    if (!questionPaper) {
        throw new HttpError(404, "Question paper not found.");
    }
    if (!questionPaper.gcs_key) {
        throw new HttpError(
            400,
            "Question paper PDF is not available yet. Please retry once it has finished processing."
        );
    }

    const storedAnswers = parseJson(answerKey?.answers, {});
    const normalizedAnswers = new Map(
        Object.entries(storedAnswers || {})
            .map(([number, answer]) => [
                Number(number),
                String(answer || "").trim().toUpperCase(),
            ])
            .filter(([number, answer]) => Number.isInteger(number) && answer)
    );
    const entries = [];
    const summaryLines = [];

    for (const raw of wrongAnswers) {
        if (!raw || typeof raw !== "object") continue;
        const questionNumber = Number(raw.question_number);
        if (!Number.isInteger(questionNumber) || questionNumber < 1) continue;
        const selectedOption = String(raw.selected_option || "").trim().toUpperCase();
        const correctOption = normalizedAnswers.get(questionNumber) || "";
        if (correctOption && selectedOption === correctOption) continue;

        const entry = {
            question_number: questionNumber,
            selected_option: selectedOption || null,
            ...(correctOption && { correct_option: correctOption }),
        };
        entries.push(entry);
        summaryLines.push(
            correctOption
                ? `Q${questionNumber}: selected ${selectedOption || "—"}, correct ${correctOption}`
                : `Q${questionNumber}: selected ${selectedOption || "—"}`
        );
    }

    if (entries.length === 0) {
        throw new HttpError(400, "No wrong answers found to review.");
    }

    const userText = [
        `MCQ Review Request — ${questionPaper.title}`,
        "",
        "Mistakes:",
        ...summaryLines,
    ].join("\n");
    const userMetadata = {
        mode: "mcq_review",
        question_paper_id: questionPaper.id,
        mark_scheme_id: markScheme?.id || null,
        wrong_answers: entries,
    };
    const userMessage = await createChatMessage({
        threadId,
        role: "user",
        mode: "mcq_review",
        text: userText,
        metadata: userMetadata,
    });
    await incrementUsage(userId, "mcq_wrong_reviews");

    const recentRows = await findChatMessagesByThread(threadId);
    const recentMessages = recentRows.slice(-20).map((message) => ({
        role: message.role,
        text: message.text || "",
        mode: message.mode,
        metadata: parseJson(message.metadata, {}),
    }));
    let response;
    let assistantError = "";

    try {
        response = await generateChatAssistantResponse({
            subjectCode: thread.subject_code || "",
            subjectName: thread.subject_name || "",
            userText,
            recentMessages,
            mode: "mcq_review",
            overrideGating: true,
            paperContext: [
                "Use the following verified answer-key entries:",
                JSON.stringify(entries),
                markScheme
                    ? `A matching mark scheme is available: ${markScheme.title || markScheme.id}.`
                    : "No matching mark scheme was found; explain only what can be supported by the answer key and retrieved context.",
                ].join("\n"),
            sourceDocuments: [
                questionPaper,
                ...(markScheme ? [{
                    id: markScheme.id,
                    title: markScheme.title,
                    gcs_key: markScheme.gcs_key,
                }] : []),
            ],
        });
    } catch (error) {
        assistantError = error.message || "assistant_generation_failed";
        response = {
            answer: "I couldn't generate feedback right now. Please try again in a moment.",
            sources: [],
            chunk_ids: [],
        };
    }

    const assistantMessage = await createChatMessage({
        threadId,
        role: "assistant",
        mode: "mcq_review",
        text: response.answer,
        modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
        chunkIds: response.chunk_ids || [],
        sources: response.sources || [],
        metadata: {
            mode: "mcq_review",
            question_paper_id: questionPaper.id,
            mark_scheme_id: markScheme?.id || null,
            ...(assistantError && { error: assistantError }),
        },
    });
    await updateChatThreadActivity(threadId, {
        preview: assistantMessage.text,
        lastMessageAt: new Date(),
    });

    return {
        user: serializeChatMessage(userMessage),
        assistant: serializeChatMessage(assistantMessage),
        mark_scheme_missing: !markScheme?.gcs_key,
    };
};

export const listChatAttachments = async (userId, threadId) => {
    await getThreadOrThrow(userId, threadId);
    const rows = await findChatAttachments(threadId, userId);
    return rows.map(serializeChatAttachment);
};

export const uploadChatAttachment = async (
    userId,
    threadId,
    file
) => {
    await getThreadOrThrow(userId, threadId);
    if (!file) throw new HttpError(400, "file is required");
    const storage = getStorage();
    if (!storage) throw new HttpError(503, "File storage is not configured.");
    const id = crypto.randomUUID();
    const kind = classifyAttachment(file.originalname, file.mimetype);
    const key = `chat_temp/${threadId}/${id}/${file.originalname}`;
    const attachment = await createChatAttachment({
        id,
        threadId,
        userId,
        originalFilename: file.originalname,
        mime: file.mimetype || "application/octet-stream",
        sizeBytes: file.size || file.buffer.length,
        kind,
        status: "uploading",
        gcsKey: key,
    });
    try {
        await storage.bucket(process.env.GCS_BUCKET_NAME).file(key).save(file.buffer, {
            resumable: false,
            metadata: { contentType: file.mimetype || "application/octet-stream" },
        });
        const updated = await updateChatAttachment(
            id,
            threadId,
            userId,
            { status: "ready" }
        );
        return serializeChatAttachment(updated);
    } catch (error) {
        await updateChatAttachment(id, threadId, userId, { status: "failed" });
        throw new HttpError(500, error.message || "Attachment upload failed.");
    }
};

export const downloadChatAttachment = async (
    userId,
    threadId,
    attachmentId
) => {
    const attachment = await findChatAttachmentById(
        attachmentId,
        threadId,
        userId
    );
    if (!attachment) throw new HttpError(404, "Attachment not found.");
    if (!attachment.gcs_key || !process.env.GCS_BUCKET_NAME) {
        throw new HttpError(404, "File not found in storage.");
    }
    const storage = getStorage();
    try {
        const [buffer] = await storage
            .bucket(process.env.GCS_BUCKET_NAME)
            .file(attachment.gcs_key)
            .download();
        return {
            buffer,
            mime: attachment.mime || "application/octet-stream",
            filename: attachment.original_filename || "attachment",
            inline: String(attachment.mime || "").startsWith("image/") ||
                attachment.mime === "application/pdf",
        };
    } catch {
        throw new HttpError(404, "File expired or deleted.");
    }
};
