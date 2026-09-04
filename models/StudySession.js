import crypto from "crypto";
import { executeQuery } from "../utils/databaseHelper.js";

const normalizeUuid = (value) => String(value || "").replace(/-/g, "").toLowerCase();
const formatUuid = (value) => {
    const raw = normalizeUuid(value);
    return raw.length === 32
        ? `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
        : value;
};
const parseJson = (value, fallback) => {
    if (value && typeof value === "object") return value;
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
};
const iso = (value) => value ? new Date(value).toISOString() : null;

const subjectSelect = `
    s.id AS subject_id, s.name AS subject_name, s.code AS subject_code,
    s.level AS subject_level, s.exam_board AS subject_exam_board,
    s.description AS subject_description, s.is_active AS subject_is_active
`;
const documentSelect = (prefix) => `
    ${prefix}.id AS ${prefix}_id, ${prefix}.title AS ${prefix}_title,
    ${prefix}.description AS ${prefix}_description,
    ${prefix}.document_type AS ${prefix}_document_type,
    ${prefix}.year AS ${prefix}_year, ${prefix}.file_url AS ${prefix}_file_url,
    ${prefix}.file_size_mb AS ${prefix}_file_size_mb,
    ${prefix}.download_count AS ${prefix}_download_count,
    ${prefix}.created_at AS ${prefix}_created_at,
    ${prefix}.subject_id AS ${prefix}_subject_id,
    ${prefix}.paper AS ${prefix}_paper, ${prefix}.series AS ${prefix}_series,
    ${prefix}.variant AS ${prefix}_variant, ${prefix}.gcs_key AS ${prefix}_gcs_key
`;

const serializeSubject = (row) => row.subject_id ? ({
    id: row.subject_id,
    name: row.subject_name,
    code: row.subject_code,
    level: row.subject_level,
    exam_board: row.subject_exam_board,
    description: row.subject_description,
    is_active: Boolean(row.subject_is_active),
}) : null;

const serializeDocument = (row, prefix) => row[`${prefix}_id`] ? ({
    id: row[`${prefix}_id`],
    title: row[`${prefix}_title`],
    description: row[`${prefix}_description`],
    document_type: row[`${prefix}_document_type`],
    year: row[`${prefix}_year`],
    file_url: row[`${prefix}_file_url`],
    file_size_mb: row[`${prefix}_file_size_mb`],
    download_count: row[`${prefix}_download_count`],
    created_at: iso(row[`${prefix}_created_at`]),
    subject_id: row[`${prefix}_subject_id`],
    paper: row[`${prefix}_paper`],
    series: row[`${prefix}_series`],
    variant: row[`${prefix}_variant`],
    gcs_key: row[`${prefix}_gcs_key`],
}) : null;

const baseSessionQuery = `
    SELECT ss.id, ss.title, ss.status, ss.questions_data,
           ss.questions_answered, ss.total_questions,
           ss.total_marks_available, ss.total_marks_earned,
           ss.created_at, ss.updated_at, ss.completed_at,
           ${subjectSelect},
           ${documentSelect("qp")},
           ${documentSelect("ms")}
    FROM api_studysession ss
    LEFT JOIN api_subject s ON s.id = ss.subject_id
    INNER JOIN api_document qp ON qp.id = ss.question_paper_id
    INNER JOIN api_document ms ON ms.id = ss.mark_scheme_id
`;

const serializeSessionList = (row) => {
    const total = Number(row.total_marks_available || 0);
    return {
        id: formatUuid(row.id),
        title: row.title,
        status: row.status,
        subject: serializeSubject(row),
        question_paper_title: row.qp_title,
        questions_answered: Number(row.questions_answered || 0),
        total_questions: Number(row.total_questions || 0),
        total_marks_available: total,
        total_marks_earned: Number(row.total_marks_earned || 0),
        progress_percentage: Number(row.total_questions || 0) > 0
            ? Math.trunc((Number(row.questions_answered || 0) / Number(row.total_questions)) * 100)
            : 0,
        marks_percentage: total > 0
            ? Math.trunc((Number(row.total_marks_earned || 0) / total) * 100)
            : 0,
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
        completed_at: iso(row.completed_at),
    };
};

const serializeAnswer = (row, attachments = [], evaluation = null) => ({
    id: formatUuid(row.id),
    answer_text: row.answer_text || "",
    is_latest: Boolean(row.is_latest),
    revision_number: Number(row.revision_number || 1),
    submitted_at: iso(row.submitted_at),
    attachments: attachments.map((item) => ({
        id: formatUuid(item.id),
        gcs_key: item.gcs_key,
        original_filename: item.original_filename,
        kind: item.kind,
        size_bytes: Number(item.size_bytes || 0),
        created_at: iso(item.created_at),
    })),
    evaluation: evaluation ? {
        id: formatUuid(evaluation.id),
        marks_awarded: Number(evaluation.marks_awarded || 0),
        max_marks: Number(evaluation.max_marks || 0),
        percentage: Number(evaluation.percentage || 0),
        marking_breakdown: parseJson(evaluation.marking_breakdown, []),
        feedback: evaluation.feedback || "",
        mark_scheme_text: evaluation.mark_scheme_text || "",
        question_text: evaluation.question_text || "",
        model_used: evaluation.model_used || "",
        evaluation_time_seconds: Number(evaluation.evaluation_time_seconds || 0),
        tokens_used: parseJson(evaluation.tokens_used, {}),
        evaluated_at: iso(evaluation.evaluated_at),
    } : null,
});

const serializeQuestion = (
    row,
    answers = [],
    chats = [],
    latestEvaluation = null
) => ({
    id: formatUuid(row.id),
    question_number: row.question_number,
    question_part: row.question_part || "",
    question_subpart: row.question_subpart || "",
    question_text: row.question_text || "",
    marks_available: Number(row.marks_available || 0),
    pdf_page_number: row.pdf_page_number,
    display_order: Number(row.display_order || 0),
    display_reference: `Q${row.question_number}${row.question_part ? `(${row.question_part})` : ""}${row.question_subpart ? `(${row.question_subpart})` : ""}`,
    has_answer: answers.some((answer) => Boolean(answer.is_latest)),
    answers: answers.map((answer) => serializeAnswer(
        answer,
        answer.attachments || [],
        answer.evaluation || null
    )),
    chat_messages: chats.map((chat) => ({
        id: formatUuid(chat.id),
        role: chat.role,
        text: chat.text,
        sources: parseJson(chat.sources, []),
        created_at: iso(chat.created_at),
    })),
    latest_marks: latestEvaluation ? {
        marks_awarded: Number(latestEvaluation.marks_awarded || 0),
        max_marks: Number(latestEvaluation.max_marks || 0),
        percentage: Number(latestEvaluation.percentage || 0),
    } : null,
    created_at: iso(row.created_at),
});

export const findStudySessions = async (userId, { subjectId = null, status = null } = {}) => {
    const conditions = ["ss.user_id = ?"];
    const params = [userId];
    if (subjectId) {
        conditions.push("ss.subject_id = ?");
        params.push(subjectId);
    }
    if (status) {
        conditions.push("ss.status = ?");
        params.push(status);
    }
    const rows = await executeQuery(
        `${baseSessionQuery} WHERE ${conditions.join(" AND ")} ORDER BY ss.updated_at DESC LIMIT 50`,
        params
    );
    return rows.map(serializeSessionList);
};

export const findStudySession = async (sessionId, userId) => {
    const rows = await executeQuery(
        `${baseSessionQuery} WHERE ss.id = ? AND ss.user_id = ? LIMIT 1`,
        [normalizeUuid(sessionId), userId]
    );
    return rows[0] || null;
};

export const createStudySession = async ({
    userId,
    subjectId,
    questionPaperId,
    markSchemeId,
    title,
}) => {
    const id = crypto.randomUUID().replace(/-/g, "");
    await executeQuery(
        `
        INSERT INTO api_studysession
            (id, title, status, questions_data, questions_answered,
             total_questions, total_marks_available, total_marks_earned,
             created_at, updated_at, completed_at, user_id, subject_id,
             question_paper_id, mark_scheme_id)
        VALUES (?, ?, 'in_progress', '{}', 0, 0, 0, 0, NOW(6), NOW(6), NULL, ?, ?, ?, ?)
        `,
        [id, title, userId, subjectId, questionPaperId, markSchemeId]
    );
    return findStudySession(id, userId);
};

export const updateStudySessionExtraction = async (
    sessionId,
    userId,
    questionsData,
    questions
) => {
    const totalMarks = questions.reduce(
        (total, question) => total + Number(question.marks_available || 0),
        0
    );
    await executeQuery(
        `
        UPDATE api_studysession
        SET questions_data = ?, total_questions = ?, total_marks_available = ?,
            updated_at = NOW(6)
        WHERE id = ? AND user_id = ?
        `,
        [
            JSON.stringify(questionsData),
            questions.length,
            totalMarks,
            normalizeUuid(sessionId),
            userId,
        ]
    );
    for (const question of questions) {
        await executeQuery(
            `
            INSERT INTO api_sessionquestion
                (id, question_number, question_part, question_subpart,
                 question_text, marks_available, pdf_page_number,
                 display_order, created_at, session_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(6), ?)
            `,
            [
                crypto.randomUUID().replace(/-/g, ""),
                question.question_number || "",
                question.question_part || "",
                question.question_subpart || "",
                question.question_text || "",
                Number(question.marks_available || 0),
                question.pdf_page_number ?? null,
                Number(question.display_order || 0),
                normalizeUuid(sessionId),
            ]
        );
    }
};

export const deleteStudySession = async (sessionId, userId) => (
    executeQuery(
        "DELETE FROM api_studysession WHERE id = ? AND user_id = ?",
        [normalizeUuid(sessionId), userId]
    )
);

export const findSessionQuestion = async (sessionId, questionId, userId) => {
    const rows = await executeQuery(
        `
        SELECT sq.*
        FROM api_sessionquestion sq
        INNER JOIN api_studysession ss ON ss.id = sq.session_id
        WHERE sq.id = ? AND sq.session_id = ? AND ss.user_id = ?
        LIMIT 1
        `,
        [normalizeUuid(questionId), normalizeUuid(sessionId), userId]
    );
    return rows[0] || null;
};

const findAnswersForQuestion = async (questionId) => (
    executeQuery(
        "SELECT * FROM api_questionanswer WHERE session_question_id = ? ORDER BY revision_number DESC",
        [normalizeUuid(questionId)]
    )
);

const findAttachmentsForAnswer = async (answerId) => (
    executeQuery(
        "SELECT * FROM api_questionanswerattachment WHERE answer_id = ? ORDER BY created_at",
        [normalizeUuid(answerId)]
    )
);

const findEvaluationForAnswer = async (answerId) => {
    const rows = await executeQuery(
        "SELECT * FROM api_questionevaluation WHERE answer_id = ? LIMIT 1",
        [normalizeUuid(answerId)]
    );
    return rows[0] || null;
};

const findChatsForQuestion = async (questionId) => (
    executeQuery(
        "SELECT * FROM api_questionchatmessage WHERE session_question_id = ? ORDER BY created_at",
        [normalizeUuid(questionId)]
    )
);

export const serializeSessionDetail = async (session) => {
    const questions = await executeQuery(
        "SELECT * FROM api_sessionquestion WHERE session_id = ? ORDER BY display_order",
        [normalizeUuid(session.id)]
    );
    const serializedQuestions = [];
    for (const question of questions) {
        const answers = await findAnswersForQuestion(question.id);
        for (const answer of answers) {
            answer.attachments = await findAttachmentsForAnswer(answer.id);
            answer.evaluation = await findEvaluationForAnswer(answer.id);
        }
        const latest = answers.find((answer) => Boolean(answer.is_latest));
        serializedQuestions.push(serializeQuestion(
            question,
            answers,
            await findChatsForQuestion(question.id),
            latest?.evaluation || null
        ));
    }
    const output = serializeSessionList(session);
    return {
        ...output,
        subject: serializeSubject(session),
        question_paper: serializeDocument(session, "qp"),
        mark_scheme: serializeDocument(session, "ms"),
        questions: serializedQuestions,
        questions_data: parseJson(session.questions_data, {}),
    };
};

export const findSessionQuestionDetail = async (sessionId, questionId, userId) => {
    const question = await findSessionQuestion(sessionId, questionId, userId);
    if (!question) return null;
    const answers = await findAnswersForQuestion(question.id);
    for (const answer of answers) {
        answer.attachments = await findAttachmentsForAnswer(answer.id);
        answer.evaluation = await findEvaluationForAnswer(answer.id);
    }
    return serializeQuestion(
        question,
        answers,
        await findChatsForQuestion(question.id),
        answers.find((answer) => Boolean(answer.is_latest))?.evaluation || null
    );
};

export const createQuestionAnswer = async ({
    questionId,
    answerText,
    revisionNumber,
}) => {
    await executeQuery(
        "UPDATE api_questionanswer SET is_latest = 0 WHERE session_question_id = ? AND is_latest = 1",
        [normalizeUuid(questionId)]
    );
    const id = crypto.randomUUID().replace(/-/g, "");
    await executeQuery(
        `
        INSERT INTO api_questionanswer
            (id, answer_text, is_latest, revision_number, submitted_at, session_question_id)
        VALUES (?, ?, 1, ?, NOW(6), ?)
        `,
        [id, answerText, revisionNumber, normalizeUuid(questionId)]
    );
    return id;
};

export const createQuestionAnswerAttachment = async ({
    answerId,
    gcsKey,
    originalFilename,
    kind,
    sizeBytes,
}) => {
    const id = crypto.randomUUID().replace(/-/g, "");
    await executeQuery(
        `
        INSERT INTO api_questionanswerattachment
            (id, gcs_key, original_filename, kind, size_bytes, created_at, answer_id)
        VALUES (?, ?, ?, ?, ?, NOW(6), ?)
        `,
        [id, gcsKey, originalFilename, kind, sizeBytes, normalizeUuid(answerId)]
    );
};

export const createQuestionEvaluation = async ({
    answerId,
    marksAwarded,
    maxMarks,
    percentage,
    markingBreakdown,
    feedback,
    markSchemeText,
    questionText,
    modelUsed,
    evaluationTimeSeconds,
    tokensUsed,
}) => {
    const id = crypto.randomUUID().replace(/-/g, "");
    await executeQuery(
        `
        INSERT INTO api_questionevaluation
            (id, marks_awarded, max_marks, percentage, marking_breakdown,
             feedback, mark_scheme_text, question_text, model_used,
             evaluation_time_seconds, tokens_used, evaluated_at, answer_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), ?)
        `,
        [
            id,
            marksAwarded,
            maxMarks,
            percentage,
            JSON.stringify(markingBreakdown || []),
            feedback,
            markSchemeText || "",
            questionText || "",
            modelUsed || "",
            evaluationTimeSeconds || 0,
            JSON.stringify(tokensUsed || {}),
            normalizeUuid(answerId),
        ]
    );
};

export const updateSessionProgress = async (sessionId, userId, complete = false) => {
    await executeQuery(
        `
        UPDATE api_studysession ss
        SET questions_answered = (
                SELECT COUNT(*)
                FROM api_questionanswer qa
                INNER JOIN api_sessionquestion sq ON sq.id = qa.session_question_id
                WHERE sq.session_id = ss.id AND qa.is_latest = 1
            ),
            total_marks_earned = COALESCE((
                SELECT SUM(qe.marks_awarded)
                FROM api_questionevaluation qe
                INNER JOIN api_questionanswer qa ON qa.id = qe.answer_id
                INNER JOIN api_sessionquestion sq ON sq.id = qa.session_question_id
                WHERE sq.session_id = ss.id AND qa.is_latest = 1
            ), 0),
            status = CASE WHEN ? = 1 THEN 'completed' ELSE status END,
            completed_at = CASE WHEN ? = 1 THEN COALESCE(completed_at, NOW(6)) ELSE completed_at END,
            updated_at = NOW(6)
        WHERE ss.id = ? AND ss.user_id = ?
        `,
        [complete ? 1 : 0, complete ? 1 : 0, normalizeUuid(sessionId), userId]
    );
};

export const findLatestAnswer = async (questionId) => {
    const rows = await executeQuery(
        `
        SELECT qa.*, qe.feedback AS evaluation_feedback
        FROM api_questionanswer qa
        LEFT JOIN api_questionevaluation qe ON qe.answer_id = qa.id
        WHERE qa.session_question_id = ? AND qa.is_latest = 1
        LIMIT 1
        `,
        [normalizeUuid(questionId)]
    );
    return rows[0] || null;
};

export const findQuestionChatHistory = async (questionId) => (
    executeQuery(
        "SELECT * FROM api_questionchatmessage WHERE session_question_id = ? ORDER BY created_at",
        [normalizeUuid(questionId)]
    )
);

export const createQuestionChatMessage = async ({
    questionId,
    role,
    text,
    relatedAnswerId = null,
    sources = [],
}) => {
    const id = crypto.randomUUID().replace(/-/g, "");
    await executeQuery(
        `
        INSERT INTO api_questionchatmessage
            (id, role, text, sources, created_at, session_question_id, related_answer_id)
        VALUES (?, ?, ?, ?, NOW(6), ?, ?)
        `,
        [
            id,
            role,
            text,
            JSON.stringify(sources || []),
            normalizeUuid(questionId),
            relatedAnswerId ? normalizeUuid(relatedAnswerId) : null,
        ]
    );
    const rows = await executeQuery(
        "SELECT * FROM api_questionchatmessage WHERE id = ? LIMIT 1",
        [id]
    );
    return rows[0] || null;
};

export { formatUuid, iso, parseJson };

