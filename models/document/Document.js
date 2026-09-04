import { executeQuery } from "../../utils/databaseHelper.js";

const SEARCHABLE_DOCUMENT_FIELDS = [
    "d.title",
    "d.description",
    "d.document_type",
    "CAST(d.year AS CHAR)",
    "CAST(d.paper AS CHAR)",
    "d.series",
    "d.variant",
    "s.name",
    "s.code",
    "s.level",
    "s.exam_board",
];

const appendDocumentSearch = (
    conditions,
    params,
    search
) => {
    const terms = String(search || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 8);

    for (const term of terms) {
        conditions.push(`
            (
                ${SEARCHABLE_DOCUMENT_FIELDS
                    .map((field) => `${field} LIKE ?`)
                    .join(" OR ")}
            )
        `);

        const pattern = `%${term}%`;
        params.push(
            ...Array(SEARCHABLE_DOCUMENT_FIELDS.length).fill(pattern)
        );
    }
};

/*
|--------------------------------------------------------------------------
| SELECT QUERIES
|--------------------------------------------------------------------------
*/

export const findDocuments = async (
    filters = {},
    connection = null
) => {
    const conditions = [];
    const params = [];

    let sql = `
        SELECT
            d.id,
            d.title,
            d.description,
            d.document_type,
            d.year,
            d.file_url,
            d.file_size_mb,
            d.download_count,
            d.created_at,
            d.subject_id,
            d.paper,
            d.series,
            d.variant,
            d.gcs_key,

            s.id AS subject_id,
            s.name AS subject_name,
            s.code AS subject_code,
            s.level AS subject_level,
            s.exam_board AS subject_exam_board

        FROM api_document d
        INNER JOIN api_subject s
            ON s.id = d.subject_id
    `;

    if (filters.subjectId) {
        conditions.push("d.subject_id = ?");
        params.push(filters.subjectId);
    }

    if (filters.documentType) {
        conditions.push("d.document_type = ?");
        params.push(filters.documentType);
    }

    if (filters.year) {
        conditions.push("d.year = ?");
        params.push(filters.year);
    }

    if (filters.search) {
        appendDocumentSearch(
            conditions,
            params,
            filters.search
        );
    }

    if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += `
        ORDER BY d.created_at DESC
    `;

    return executeQuery(sql, params, connection);
};

export const findDocumentById = async (
    documentId,
    connection = null
) => {
    const sql = `
        SELECT
            d.id,
            d.title,
            d.description,
            d.document_type,
            d.year,
            d.file_url,
            d.file_size_mb,
            d.download_count,
            d.created_at,
            d.subject_id,
            d.paper,
            d.series,
            d.variant,
            d.gcs_key,

            s.id AS subject_id,
            s.name AS subject_name,
            s.code AS subject_code,
            s.level AS subject_level,
            s.exam_board AS subject_exam_board

        FROM api_document d
        INNER JOIN api_subject s
            ON s.id = d.subject_id

        WHERE d.id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(
        sql,
        [documentId],
        connection
    );

    return rows[0] || null;
};

export const incrementDocumentDownloadCount = async (
    documentId,
    connection = null
) => {
    const sql = `
        UPDATE api_document
        SET download_count = download_count + 1
        WHERE id = ?
    `;

    return executeQuery(
        sql,
        [documentId],
        connection
    );
};

export const findActiveSubjectByIdentifier = async (
    subjectIdentifier,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT
            id,
            name,
            code,
            level,
            exam_board,
            is_active
        FROM api_subject
        WHERE is_active = 1
          AND (
              id = ?
              OR code = ?
          )
        ORDER BY id ASC
        LIMIT 1
        `,
        [
            subjectIdentifier,
            String(subjectIdentifier || ""),
        ],
        connection
    );

    return rows[0] || null;
};

export const findDocumentsBySubject = async (
    subjectId,
    filters = {},
    connection = null
) => {
    const conditions = [
        "d.subject_id = ?",
        "s.is_active = 1",
    ];

    const params = [subjectId];

    let sql = `
        SELECT
            d.id,
            d.title,
            d.description,
            d.document_type,
            d.year,
            d.file_url,
            d.file_size_mb,
            d.download_count,
            d.created_at,
            d.subject_id,
            d.paper,
            d.series,
            d.variant,
            d.gcs_key,

            s.id AS subject_id,
            s.name AS subject_name,
            s.code AS subject_code,
            s.level AS subject_level,
            s.exam_board AS subject_exam_board

        FROM api_document d

        INNER JOIN api_subject s
            ON s.id = d.subject_id
    `;

    if (filters.documentType) {
        conditions.push("d.document_type = ?");
        params.push(filters.documentType);
    }

    if (filters.year) {
        conditions.push("d.year = ?");
        params.push(filters.year);
    }

    if (filters.paper) {
        conditions.push("d.paper = ?");
        params.push(filters.paper);
    }

    if (filters.variant) {
        conditions.push("d.variant = ?");
        params.push(filters.variant);
    }

    if (filters.search) {
        appendDocumentSearch(
            conditions,
            params,
            filters.search
        );
    }

    sql += `
        WHERE ${conditions.join(" AND ")}

        ORDER BY
            d.year DESC,
            CASE
                WHEN LOWER(d.series) = 'winter' THEN 1
                WHEN LOWER(d.series) = 'summer' THEN 2
                WHEN LOWER(d.series) = 'march' THEN 3
                ELSE 9
            END,
            d.document_type ASC,
            d.paper ASC,
            d.variant ASC
    `;

    return executeQuery(
        sql,
        params,
        connection
    );
};

export const isUserEnrolledInSubject = async (
    userId,
    subjectId,
    connection = null
) => {
    const sql = `
        SELECT 1
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

    return rows.length > 0;
};

export const findMcqAnswerKeyByQuestionPaper = async (
    documentId,
    connection = null
) => {
    const sql = `
        SELECT
            id,
            answers,
            total_questions,
            extraction_method,
            source_pdf_hash,
            metadata,
            extracted_at,
            updated_at,
            mark_scheme_id,
            question_paper_id,
            subject_id
        FROM api_mcqanswerkey
        WHERE question_paper_id = ?
        LIMIT 1
    `;

    const rows = await executeQuery(
        sql,
        [documentId],
        connection
    );

    return rows[0] || null;
};

export const findMcqReviewDocuments = async (
    documentId,
    connection = null
) => {
    const documentRows = await executeQuery(
        `
        SELECT
            d.id, d.title, d.document_type, d.year, d.series,
            d.paper, d.variant, d.gcs_key, d.subject_id
        FROM api_document d
        WHERE d.id = ?
        LIMIT 1
        `,
        [documentId],
        connection
    );
    const questionPaper = documentRows[0] || null;
    if (!questionPaper) {
        return {
            questionPaper: null,
            answerKey: null,
            markScheme: null,
        };
    }

    const keyRows = await executeQuery(
        `
        SELECT
            k.id, k.answers, k.total_questions, k.extraction_method,
            k.mark_scheme_id, k.question_paper_id,
            ms.title AS mark_scheme_title,
            ms.gcs_key AS mark_scheme_gcs_key
        FROM api_mcqanswerkey k
        LEFT JOIN api_document ms ON ms.id = k.mark_scheme_id
        WHERE k.question_paper_id = ?
        LIMIT 1
        `,
        [documentId],
        connection
    );
    const answerKey = keyRows[0] || null;
    let markScheme = answerKey?.mark_scheme_id
        ? {
            id: answerKey.mark_scheme_id,
            title: answerKey.mark_scheme_title,
            gcs_key: answerKey.mark_scheme_gcs_key,
        }
        : null;

    if (!markScheme) {
        const conditions = [
            "subject_id = ?",
            "LOWER(document_type) LIKE '%mark%'",
        ];
        const params = [questionPaper.subject_id];
        for (const [column, value] of [
            ["year", questionPaper.year],
            ["paper", questionPaper.paper],
            ["variant", questionPaper.variant],
        ]) {
            if (value !== null && value !== undefined && String(value) !== "") {
                conditions.push(`${column} = ?`);
                params.push(value);
            }
        }
        const rows = await executeQuery(
            `
            SELECT id, title, gcs_key
            FROM api_document
            WHERE ${conditions.join(" AND ")}
            ORDER BY created_at DESC
            LIMIT 1
            `,
            params,
            connection
        );
        markScheme = rows[0] || null;
    }

    return {
        questionPaper,
        answerKey,
        markScheme,
    };
};
