// Cache for AI-extracted question-paper questions, keyed by the
// (question paper, mark scheme) document pair. Extraction reads both full
// PDFs and runs a heavy LLM call, and every past paper is shared across
// many users/study sessions, so the first extraction is reused for every
// later session on the same paper instead of re-running it from scratch
// each time.

import { executeQuery } from "../utils/databaseHelper.js";

export const findExtractionCache = async (
    questionPaperId,
    markSchemeId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT extraction_data, extraction_model, processing_time_seconds
        FROM api_documentextractioncache
        WHERE question_paper_id = ?
          AND mark_scheme_id = ?
        LIMIT 1
        `,
        [questionPaperId, markSchemeId],
        connection
    );

    return rows[0] || null;
};

export const saveExtractionCache = async (
    {
        questionPaperId,
        markSchemeId,
        extractionData,
        extractionModel,
        processingTimeSeconds,
    },
    connection = null
) => {
    await executeQuery(
        `
        INSERT INTO api_documentextractioncache (
            question_paper_id, mark_scheme_id, extraction_data,
            extraction_model, processing_time_seconds, created_at
        )
        VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            extraction_data = VALUES(extraction_data),
            extraction_model = VALUES(extraction_model),
            processing_time_seconds = VALUES(processing_time_seconds),
            created_at = NOW()
        `,
        [
            questionPaperId,
            markSchemeId,
            JSON.stringify(extractionData),
            extractionModel || null,
            processingTimeSeconds || 0,
        ],
        connection
    );
};
