import { executeQuery } from "../utils/databaseHelper.js";

const buildDocumentFilters = (
    {
        subjectCode,
        documentTypes = [],
        terms = [],
        qrefHint = null,
    } = {}
) => {
    const conditions = ["rc.kind = 'text'"];
    const params = [];

    if (subjectCode) {
        conditions.push("s.code = ?");
        params.push(subjectCode);
    }

    if (documentTypes.length > 0) {
        conditions.push(
            `d.document_type IN (${documentTypes.map(() => "?").join(", ")})`
        );
        params.push(...documentTypes);
    }

    if (qrefHint) {
        conditions.push("rc.qref = ?");
        params.push(qrefHint);
    }

    if (terms.length > 0) {
        conditions.push(
            `(${terms.map(() => "LOWER(rc.text) LIKE ?").join(" OR ")})`
        );
        params.push(...terms.map((term) => `%${term.toLowerCase()}%`));
    }

    return { conditions, params };
};

export const findRagChunksByIds = async (
    chunkIds,
    connection = null
) => {
    if (!Array.isArray(chunkIds) || chunkIds.length === 0) {
        return [];
    }

    const placeholders = chunkIds.map(() => "?").join(", ");
    return executeQuery(
        `
        SELECT
            rc.id AS chunk_id,
            rc.kind,
            rc.text,
            rc.page_start,
            rc.page_end,
            rc.qref,
            rc.pair_key,
            d.id AS doc_id,
            s.code AS subject_code,
            d.year,
            d.series,
            d.document_type,
            d.paper,
            d.variant,
            d.title AS doc_title
        FROM api_ragchunk rc
        INNER JOIN api_document d ON d.id = rc.document_id
        INNER JOIN api_subject s ON s.id = d.subject_id
        WHERE rc.kind = 'text'
          AND rc.id IN (${placeholders})
        `,
        chunkIds,
        connection
    );
};

export const findLexicalRagChunks = async (
    {
        subjectCode,
        documentTypes = [],
        terms = [],
        qrefHint = null,
        limit = 500,
    } = {},
    connection = null
) => {
    const safeLimit = Math.min(1000, Math.max(1, Number(limit) || 500));
    const { conditions, params } = buildDocumentFilters({
        subjectCode,
        documentTypes,
        terms,
        qrefHint,
    });

    return executeQuery(
        `
        SELECT
            rc.id AS chunk_id,
            rc.kind,
            rc.text,
            rc.page_start,
            rc.page_end,
            rc.qref,
            rc.pair_key,
            d.id AS doc_id,
            s.code AS subject_code,
            d.year,
            d.series,
            d.document_type,
            d.paper,
            d.variant,
            d.title AS doc_title
        FROM api_ragchunk rc
        INNER JOIN api_document d ON d.id = rc.document_id
        INNER JOIN api_subject s ON s.id = d.subject_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY d.year DESC, rc.id ASC
        LIMIT ${safeLimit}
        `,
        params,
        connection
    );
};
