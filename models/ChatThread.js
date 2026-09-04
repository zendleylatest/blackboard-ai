import { executeQuery } from "../utils/databaseHelper.js";
import crypto from "crypto";

const normalizeUuid = (value) => String(value || "").replace(/-/g, "").toLowerCase();


/**
 * Get chat threads belonging to a user.
 */
export const findChatThreadsByUser = async (
    userId,
    subjectId = null,
    connection = null
) => {
    let sql = `
        SELECT
            t.id,
            t.title,
            t.summary,
            t.last_message_preview,
            t.last_message_at,
            t.openai_vector_store_id,
            t.created_at,
            t.updated_at,
            t.subject_id,
            t.user_id,
            s.id AS subject_id,
            s.name AS subject_name,
            s.code AS subject_code,
            s.level AS subject_level,
            s.exam_board AS subject_exam_board,
            s.description AS subject_description,
            s.is_active AS subject_is_active
        FROM api_chatthread t
        LEFT JOIN api_subject s ON s.id = t.subject_id
        WHERE t.user_id = ?
    `;

    const params = [userId];

    if (subjectId) {
        sql += `
            AND t.subject_id = ?
        `;

        params.push(subjectId);
    }

    sql += `
        ORDER BY t.updated_at DESC
        LIMIT 100
    `;

    return executeQuery(
        sql,
        params,
        connection
    );
};

/**
 * Find a ChatThread by ID belonging to a user.
 */
export const findChatThreadById = async (
    threadId,
    userId,
    connection = null
) => {
    const sql = `
        SELECT
            t.id,
            t.title,
            t.summary,
            t.last_message_preview,
            t.last_message_at,
            t.openai_vector_store_id,
            t.created_at,
            t.updated_at,
            t.subject_id,
            t.user_id,
            s.id AS subject_id,
            s.name AS subject_name,
            s.code AS subject_code,
            s.level AS subject_level,
            s.exam_board AS subject_exam_board,
            s.description AS subject_description,
            s.is_active AS subject_is_active
        FROM api_chatthread t
        LEFT JOIN api_subject s ON s.id = t.subject_id
        WHERE t.id = ?
          AND t.user_id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(
        sql,
        [normalizeUuid(threadId), userId],
        connection
    );

    return rows[0] || null;
};

/**
 * Find a subject by ID.
 */
export const findSubjectById = async (
    subjectId,
    connection = null
) => {
    const sql = `
        SELECT
            id,
            name,
            code,
            level,
            exam_board,
            description,
            is_active
        FROM api_subject
        WHERE id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(
        sql,
        [subjectId],
        connection
    );

    return rows[0] || null;
};

/**
 * Check whether a user is enrolled in a subject.
 */
export const findUserSubjectEnrollment = async (
    userId,
    subjectId,
    connection = null
) => {
    const sql = `
        SELECT
            id
        FROM api_usersubject
        WHERE user_id = ?
          AND subject_id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(
        sql,
        [userId, subjectId],
        connection
    );

    return rows[0] || null;
};

/**
 * Create a new ChatThread.
 */
export const createChatThread = async (
    userId,
    subjectId,
    title,
    connection = null
) => {
    const threadId = crypto.randomUUID().replace(/-/g, "");
    const sql = `
        INSERT INTO api_chatthread (
            id,
            user_id,
            subject_id,
            title,
            summary,
            last_message_preview,
            last_message_at,
            openai_vector_store_id,
            created_at,
            updated_at
        )
        VALUES (
            ?,
            ?,
            ?,
            ?,
            '',
            '',
            NULL,
            '',
            NOW(6),
            NOW(6)
        )
    `;

    await executeQuery(
        sql,
        [
            threadId,
            userId,
            subjectId,
            title,
        ],
        connection
    );

    return findChatThreadById(threadId, userId, connection);
};

/**
 * Find the latest thread created by a user.
 *
 * Used after INSERT because the UUID is generated
 * by MySQL in the INSERT query.
 */
export const findLatestCreatedChatThread = async (
    userId,
    connection = null
) => {
    const sql = `
        SELECT
            t.id,
            t.title,
            t.summary,
            t.last_message_preview,
            t.last_message_at,
            t.openai_vector_store_id,
            t.created_at,
            t.updated_at,
            t.subject_id,
            t.user_id
        FROM api_chatthread t
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC
        LIMIT 1
    `;

    const rows = await executeQuery(
        sql,
        [userId],
        connection
    );

    return rows[0] || null;
};

/**
 * Delete a ChatThread belonging to a user.
 */
export const deleteChatThread = async (
    threadId,
    userId,
    connection = null
) => {
    const sql = `
        DELETE FROM api_chatthread
        WHERE id = ?
          AND user_id = ?
    `;

    return executeQuery(
        sql,
        [normalizeUuid(threadId), userId],
        connection
    );
};

/**
 * Update the title of a ChatThread.
 */
export const updateChatThreadTitle = async (
    threadId,
    title,
    connection = null
) => {
    const sql = `
        UPDATE api_chatthread
        SET
            title = ?,
            updated_at = NOW(6)
        WHERE id = ?
    `;

    return executeQuery(
        sql,
        [title, normalizeUuid(threadId)],
        connection
    );
};

export const updateChatThreadActivity = async (
    threadId,
    {
        title,
        preview,
        lastMessageAt = new Date(),
    },
    connection = null
) => {
    const fields = [
        "last_message_preview = ?",
        "last_message_at = ?",
        "updated_at = NOW(6)",
    ];
    const params = [
        String(preview || "").slice(0, 240),
        lastMessageAt,
    ];
    if (title !== undefined) {
        fields.unshift("title = ?");
        params.unshift(String(title || "").slice(0, 120));
    }
    params.push(normalizeUuid(threadId));
    return executeQuery(
        `
        UPDATE api_chatthread
        SET ${fields.join(", ")}
        WHERE id = ?
        `,
        params,
        connection
    );
};

/**
 * Get messages for a ChatThread.
 */
export const findChatMessagesByThread = async (
    threadId,
    connection = null
) => {
    const sql = `
        SELECT
            id, role, mode, text, tokens_in, tokens_out, model_name,
            chunk_ids, sources, metadata, created_at, thread_id
        FROM api_chatmessage
        WHERE thread_id = ?
        ORDER BY created_at ASC
    `;

    return executeQuery(
        sql,
        [normalizeUuid(threadId)],
        connection
    );
};

export const createChatMessage = async ({
    id = crypto.randomUUID().replace(/-/g, ""),
    threadId,
    role,
    mode = "assistant",
    text = "",
    tokensIn = null,
    tokensOut = null,
    modelName = "",
    chunkIds = [],
    sources = [],
    metadata = {},
}, connection = null) => {
    await executeQuery(
        `
        INSERT INTO api_chatmessage
            (id, thread_id, role, mode, text, tokens_in, tokens_out,
             model_name, chunk_ids, sources, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6))
        `,
        [
            normalizeUuid(id),
            normalizeUuid(threadId),
            role,
            mode,
            text,
            tokensIn,
            tokensOut,
            modelName,
            JSON.stringify(chunkIds || []),
            JSON.stringify(sources || []),
            JSON.stringify(metadata || {}),
        ],
        connection
    );
    const rows = await executeQuery(
        `
        SELECT id, role, mode, text, tokens_in, tokens_out, model_name,
               chunk_ids, sources, metadata, created_at, thread_id
        FROM api_chatmessage
        WHERE id = ?
        LIMIT 1
        `,
        [normalizeUuid(id)],
        connection
    );
    return rows[0] || null;
};

export const linkChatAttachmentsToMessage = async (
    attachmentIds,
    threadId,
    userId,
    messageId,
    connection = null
) => {
    if (!Array.isArray(attachmentIds) || attachmentIds.length === 0) return;
    const placeholders = attachmentIds.map(() => "?").join(", ");
    await executeQuery(
        `
        UPDATE api_chatattachment
        SET message_id = ?
        WHERE thread_id = ?
          AND uploader_id = ?
          AND id IN (${placeholders})
        `,
        [
            normalizeUuid(messageId),
            normalizeUuid(threadId),
            userId,
            ...attachmentIds.map(normalizeUuid),
        ],
        connection
    );
};

export const findChatAttachments = async (
    threadId,
    userId,
    messageId = null,
    connection = null
) => {
    const params = [normalizeUuid(threadId), userId];
    let sql = `
        SELECT id, original_filename, mime, size_bytes, kind, status,
               openai_file_id, gcs_key, preview_url, created_at, message_id
        FROM api_chatattachment
        WHERE thread_id = ?
          AND uploader_id = ?
    `;
    if (messageId) {
        sql += " AND message_id = ?";
        params.push(normalizeUuid(messageId));
    }
    sql += " ORDER BY created_at DESC";
    return executeQuery(sql, params, connection);
};

export const findChatAttachmentById = async (
    attachmentId,
    threadId,
    userId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT id, original_filename, mime, size_bytes, kind, status,
               openai_file_id, gcs_key, preview_url, created_at, message_id
        FROM api_chatattachment
        WHERE id = ? AND thread_id = ? AND uploader_id = ?
        LIMIT 1
        `,
        [
            normalizeUuid(attachmentId),
            normalizeUuid(threadId),
            userId,
        ],
        connection
    );
    return rows[0] || null;
};

export const createChatAttachment = async ({
    id = crypto.randomUUID().replace(/-/g, ""),
    threadId,
    userId,
    originalFilename,
    mime,
    sizeBytes = 0,
    kind = "other",
    status = "uploading",
    gcsKey = "",
}) => {
    await executeQuery(
        `
        INSERT INTO api_chatattachment
            (id, thread_id, uploader_id, original_filename, mime, size_bytes,
             kind, status, openai_file_id, gcs_key, preview_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, '', NOW(6))
        `,
        [
            normalizeUuid(id),
            normalizeUuid(threadId),
            userId,
            originalFilename,
            mime,
            sizeBytes,
            kind,
            status,
            gcsKey,
        ]
    );
    return findChatAttachmentById(id, threadId, userId);
};

export const updateChatAttachment = async (
    attachmentId,
    threadId,
    userId,
    updates = {}
) => {
    const fields = [];
    const params = [];
    for (const [column, value] of Object.entries(updates)) {
        fields.push(`${column} = ?`);
        params.push(value);
    }
    if (fields.length === 0) {
        return findChatAttachmentById(attachmentId, threadId, userId);
    }
    params.push(
        normalizeUuid(attachmentId),
        normalizeUuid(threadId),
        userId
    );
    await executeQuery(
        `
        UPDATE api_chatattachment
        SET ${fields.join(", ")}
        WHERE id = ? AND thread_id = ? AND uploader_id = ?
        `,
        params
    );
    return findChatAttachmentById(attachmentId, threadId, userId);
};

/**
 * Delete all ChatThreads belonging to a user
 * and subject.
 *
 * Used by UserSubject unenrollment.
 */
export const deleteChatThreadsByUserAndSubject = async (
    userId,
    subjectId,
    connection = null
) => {
    const sql = `
        DELETE FROM api_chatthread
        WHERE user_id = ?
          AND subject_id = ?
    `;

    return executeQuery(
        sql,
        [userId, subjectId],
        connection
    );
};
