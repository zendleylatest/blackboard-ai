import crypto from "crypto";
import { executeQuery } from "../utils/databaseHelper.js";

const normalizeUuid = (value) => String(value || "").replace(/-/g, "").toLowerCase();

export const findQuestionMappingsByDocument = async (
    documentId,
    questionNumber = null,
    questionPart = null,
    questionSubpart = null
) => {
    const conditions = ["document_id = ?"];
    const params = [documentId];
    if (questionNumber) {
        conditions.push("question_number = ?");
        params.push(questionNumber);
    }
    if (questionPart) {
        conditions.push("question_part = ?");
        params.push(questionPart);
    }
    if (questionSubpart) {
        conditions.push("question_subpart = ?");
        params.push(questionSubpart);
    }
    return executeQuery(
        `
        SELECT id, document_id, question_number, question_part, question_subpart,
               mark_scheme_text, max_marks, page_number, chunk_id, created_at
        FROM api_questionmapping
        WHERE ${conditions.join(" AND ")}
        ORDER BY question_number, question_part, question_subpart
        `,
        params
    );
};

export const findMatchingMarkScheme = async (questionPaper) => {
    const conditions = [
        "subject_id = ?",
        "document_type = 'marking_scheme'",
    ];
    const exactParams = [questionPaper.subject_id];
    for (const [column, value] of [
        ["year", questionPaper.year],
        ["series", questionPaper.series],
        ["paper", questionPaper.paper],
        ["variant", questionPaper.variant],
    ]) {
        if (value !== null && value !== undefined && String(value).trim() !== "") {
            conditions.push(`${column} = ?`);
            exactParams.push(value);
        }
    }
    let rows = await executeQuery(
        `
        SELECT id, title, document_type, year, series, paper, variant, gcs_key,
               subject_id
        FROM api_document
        WHERE ${conditions.join(" AND ")}
        ORDER BY id
        LIMIT 1
        `,
        exactParams
    );
    if (rows.length === 0 && questionPaper.variant) {
        rows = await executeQuery(
            `
            SELECT id, title, document_type, year, series, paper, variant, gcs_key,
                   subject_id
            FROM api_document
            WHERE subject_id = ? AND document_type = 'marking_scheme'
              AND year <=> ? AND series <=> ? AND paper <=> ?
            ORDER BY id
            LIMIT 1
            `,
            [
                questionPaper.subject_id,
                questionPaper.year,
                questionPaper.series,
                questionPaper.paper,
            ]
        );
    }
    return rows[0] || null;
};

export const createAICheckerEvaluation = async ({
    threadId,
    messageId,
    mode,
    questionText,
    studentAnswer,
    questionPaperId = null,
    questionNumber = "",
    questionPart = "",
    questionSubpart = "",
    marksAwarded,
    maxMarks,
    markingRubric = {},
    feedback = "",
    strengths = [],
    improvements = [],
    modelUsed = "",
    evaluationTimeSeconds = null,
}) => {
    const id = crypto.randomUUID().replace(/-/g, "");
    await executeQuery(
        `
        INSERT INTO api_aicheckerevaluation
            (id, mode, question_text, student_answer, question_number,
             question_part, question_subpart, marks_awarded, max_marks,
             marking_rubric, feedback, strengths, improvements, model_used,
             evaluation_time_seconds, created_at, message_id, question_paper_id,
             thread_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), ?, ?, ?)
        `,
        [
            id,
            mode,
            questionText,
            studentAnswer,
            questionNumber,
            questionPart,
            questionSubpart,
            marksAwarded,
            maxMarks,
            JSON.stringify(markingRubric || {}),
            feedback,
            Array.isArray(strengths) ? strengths.join(", ") : String(strengths || ""),
            Array.isArray(improvements)
                ? improvements.join(", ")
                : String(improvements || ""),
            modelUsed,
            evaluationTimeSeconds,
            normalizeUuid(messageId),
            questionPaperId,
            normalizeUuid(threadId),
        ]
    );
    return findAICheckerEvaluationById(id);
};

const parseJson = (value, fallback) => {
    if (value && typeof value === "object") return value;
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
};

const serializeEvaluation = (row) => ({
    id: normalizeUuid(row.id).replace(
        /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
        "$1-$2-$3-$4-$5"
    ),
    mode: row.mode,
    question_text: row.question_text,
    student_answer: row.student_answer,
    marks_awarded: row.marks_awarded === null ? null : Number(row.marks_awarded),
    max_marks: row.max_marks === null ? null : Number(row.max_marks),
    marking_rubric: parseJson(row.marking_rubric, {}),
    feedback: row.feedback || "",
    strengths: row.strengths ? String(row.strengths).split(", ").filter(Boolean) : [],
    improvements: row.improvements
        ? String(row.improvements).split(", ").filter(Boolean)
        : [],
    question_paper: row.question_paper_id
        ? {
            id: row.question_paper_id,
            title: row.question_paper_title,
            year: row.question_paper_year,
        }
        : null,
    question_number: row.question_number || "",
    question_part: row.question_part || "",
    question_subpart: row.question_subpart || "",
    model_used: row.model_used || "",
    evaluation_time_seconds: row.evaluation_time_seconds === null
        ? null
        : Number(row.evaluation_time_seconds),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
});

export const findAICheckerEvaluationById = async (evaluationId) => {
    const rows = await executeQuery(
        `
        SELECT e.*, d.title AS question_paper_title, d.year AS question_paper_year
        FROM api_aicheckerevaluation e
        LEFT JOIN api_document d ON d.id = e.question_paper_id
        WHERE e.id = ?
        LIMIT 1
        `,
        [normalizeUuid(evaluationId)]
    );
    return rows[0] ? serializeEvaluation(rows[0]) : null;
};

export const findAICheckerEvaluationForUser = async (
    evaluationId,
    userId
) => {
    const rows = await executeQuery(
        `
        SELECT e.*, d.title AS question_paper_title, d.year AS question_paper_year
        FROM api_aicheckerevaluation e
        INNER JOIN api_chatthread t ON t.id = e.thread_id
        LEFT JOIN api_document d ON d.id = e.question_paper_id
        WHERE e.id = ? AND t.user_id = ?
        LIMIT 1
        `,
        [normalizeUuid(evaluationId), userId]
    );
    return rows[0] ? serializeEvaluation(rows[0]) : null;
};

export const findAICheckerHistory = async (threadId) => {
    const rows = await executeQuery(
        `
        SELECT e.id, e.mode, e.question_text, e.marks_awarded, e.max_marks,
               e.feedback, e.question_number, e.question_part, e.question_subpart,
               e.created_at, e.question_paper_id, d.title AS question_paper_title,
               d.year AS question_paper_year
        FROM api_aicheckerevaluation e
        LEFT JOIN api_document d ON d.id = e.question_paper_id
        WHERE e.thread_id = ?
        ORDER BY e.created_at DESC
        `,
        [normalizeUuid(threadId)]
    );
    return rows.map((row) => ({
        id: normalizeUuid(row.id).replace(
            /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
            "$1-$2-$3-$4-$5"
        ),
        mode: row.mode,
        question_text: String(row.question_text || "").length > 100
            ? `${String(row.question_text).slice(0, 100)}...`
            : row.question_text || "",
        marks_awarded: row.marks_awarded === null ? null : Number(row.marks_awarded),
        max_marks: row.max_marks === null ? null : Number(row.max_marks),
        feedback: String(row.feedback || "").length > 200
            ? `${String(row.feedback).slice(0, 200)}...`
            : row.feedback || "",
        question_paper: row.question_paper_id
            ? {
                id: row.question_paper_id,
                title: row.question_paper_title,
                year: row.question_paper_year,
            }
            : null,
        question_number: row.question_number || "",
        question_part: row.question_part || "",
        question_subpart: row.question_subpart || "",
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    }));
};
