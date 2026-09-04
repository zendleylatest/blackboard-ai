import {
    findChatThreadsByUser,
    findChatThreadById,
    findSubjectById,
    findUserSubjectEnrollment,
    createChatThread,
    deleteChatThread,
    updateChatThreadTitle,
    findChatMessagesByThread,
    findChatAttachments,
    deleteChatThreadsByUserAndSubject,
} from "../models/ChatThread.js";

const parseJson = (value, fallback) => {
    if (value && typeof value === "object") return value;
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
};

const iso = (value) => value ? new Date(value).toISOString() : null;
const formatUuid = (value) => {
    const raw = String(value || "").replace(/-/g, "");
    return raw.length === 32
        ? `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
        : value;
};

const serializeSubject = (thread) => (
    thread?.subject_id
        ? {
            id: thread.subject_id,
            name: thread.subject_name,
            code: thread.subject_code,
            level: thread.subject_level,
            exam_board: thread.subject_exam_board,
            description: thread.subject_description,
            is_active: Boolean(thread.subject_is_active),
        }
        : null
);

export const serializeChatThread = (thread) => ({
    id: formatUuid(thread.id),
    subject: serializeSubject(thread),
    title: thread.title || "",
    summary: thread.summary || "",
    last_message_preview: thread.last_message_preview || "",
    last_message_at: iso(thread.last_message_at),
    openai_vector_store_id: thread.openai_vector_store_id || "",
    created_at: iso(thread.created_at),
    updated_at: iso(thread.updated_at),
});

export const serializeChatAttachment = (attachment) => ({
    id: formatUuid(attachment.id),
    original_filename: attachment.original_filename,
    mime: attachment.mime,
    size_bytes: Number(attachment.size_bytes || 0),
    kind: attachment.kind,
    status: attachment.status,
    preview_url: attachment.preview_url || "",
    openai_file_id: attachment.openai_file_id || "",
    gcs_key: attachment.gcs_key || "",
    created_at: iso(attachment.created_at),
    message_id: attachment.message_id ? formatUuid(attachment.message_id) : null,
});

export const serializeChatMessage = (
    message,
    attachments = []
) => ({
    id: formatUuid(message.id),
    role: message.role,
    mode: message.mode || "assistant",
    text: message.text || "",
    tokens_in: message.tokens_in === null ? null : Number(message.tokens_in || 0),
    tokens_out: message.tokens_out === null ? null : Number(message.tokens_out || 0),
    model_name: message.model_name || "",
    chunk_ids: parseJson(message.chunk_ids, []),
    sources: parseJson(message.sources, []),
    metadata: parseJson(message.metadata, {}),
    created_at: iso(message.created_at),
    attachments: attachments.map(serializeChatAttachment),
});

/**
 * List user's ChatThreads.
 */
export const listUserChatThreads = async (
    userId,
    subjectId = null
) => {
    const threads = await findChatThreadsByUser(
        userId,
        subjectId
    );
    return threads.map(serializeChatThread);
};

/**
 * Create a ChatThread.
 */
export const createUserChatThread = async (
    userId,
    subjectId = null,
    title = ""
) => {
    let subject = null;

    if (subjectId) {
        subject = await findSubjectById(
            subjectId
        );

        if (
            subject &&
            !(await findUserSubjectEnrollment(
                userId,
                subjectId
            ))
        ) {
            const error = new Error(
                "Not enrolled in this subject"
            );

            error.statusCode = 403;

            throw error;
        }
    }

    const thread = await createChatThread(
        userId,
        subjectId,
        title.trim().slice(0, 120)
    );
    return serializeChatThread(thread);
};

/**
 * Delete a user's ChatThread.
 */
export const deleteUserChatThread = async (
    userId,
    threadId
) => {
    const thread = await findChatThreadById(
        threadId,
        userId
    );

    if (!thread) {
        const error = new Error(
            "Chat thread not found"
        );

        error.statusCode = 404;

        throw error;
    }

    await deleteChatThread(
        threadId,
        userId
    );

    return { success: true };
};

/**
 * Generate a title from the first message.
 *
 * Matches the Django implementation:
 * - First line only
 * - Collapse whitespace
 * - Maximum title length of 50
 * - Optional subject code prefix
 */
export const generateChatTitle = (
    userText,
    subjectCode = ""
) => {
    const firstLine = (
        userText || ""
    )
        .trim()
        .split(/\r?\n/)[0];

    let candidate = firstLine.replace(
        /\s+/g,
        " "
    );

    if (!candidate) {
        candidate = "New Chat";
    }

    let sanitized = sanitizeTitle(
        candidate,
        "New Chat",
        50
    );

    if (
        subjectCode &&
        subjectCode.trim()
    ) {
        const prefix =
            `${subjectCode.trim()} - `;

        const maxTitleLength =
            50 - prefix.length;

        if (
            sanitized.length >
            maxTitleLength
        ) {
            sanitized =
                sanitized.slice(
                    0,
                    maxTitleLength - 3
                ) + "...";
        }

        return `${prefix}${sanitized}`;
    }

    return sanitized;
};

/**
 * Basic equivalent of sanitize_title.
 */
const sanitizeTitle = (
    value,
    fallback = "New Chat",
    maxLength = 50
) => {
    const sanitized = value
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);

    return sanitized || fallback;
};

/**
 * Generate and save a ChatThread title.
 */
export const generateAndSaveChatTitle = async (
    userId,
    threadId,
    firstMessage,
    subjectCode = ""
) => {
    const thread = await findChatThreadById(
        threadId,
        userId
    );

    if (!thread) {
        const error = new Error(
            "Chat thread not found"
        );

        error.statusCode = 404;

        throw error;
    }

    const newTitle =
        generateChatTitle(
            firstMessage,
            subjectCode
        );

    await updateChatThreadTitle(
        threadId,
        newTitle
    );

    return {
        title: newTitle,
    };
};

/**
 * Get messages for a user's ChatThread.
 */
export const getUserThreadMessages = async (
    userId,
    threadId
) => {
    const thread = await findChatThreadById(
        threadId,
        userId
    );

    if (!thread) {
        const error = new Error(
            "Chat thread not found"
        );

        error.statusCode = 404;

        throw error;
    }

    const messages = await findChatMessagesByThread(threadId);
    const output = [];
    for (const message of messages) {
        const attachments = await findChatAttachments(
            threadId,
            userId,
            message.id
        );
        output.push(serializeChatMessage(message, attachments));
    }
    return output;
};

/**
 * Delete all ChatThreads for a user and subject.
 */
export const deleteUserSubjectChatThreads = async (
    userId,
    subjectId,
    connection = null
) => {
    return deleteChatThreadsByUserAndSubject(
        userId,
        subjectId,
        connection
    );
};
