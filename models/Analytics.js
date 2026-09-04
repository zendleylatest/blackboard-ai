import { executeQuery } from "../utils/databaseHelper.js";

const FEATURE_QUERIES = {
    ai_quizzes_generated: `
        SELECT DATE(q.created_at) AS day, q.subject_id, COUNT(*) AS count
        FROM api_quiz q
        WHERE q.created_at >= ? AND q.created_at < ?
          AND (? IS NULL OR q.subject_id = ?)
        GROUP BY DATE(q.created_at), q.subject_id
    `,
    ai_flashcards_generated: `
        SELECT DATE(f.created_at) AS day, f.subject_id, COUNT(*) AS count
        FROM api_flashcardset f
        WHERE f.is_ai_generated = 1
          AND f.created_at >= ? AND f.created_at < ?
          AND (? IS NULL OR f.subject_id = ?)
        GROUP BY DATE(f.created_at), f.subject_id
    `,
    chat_assistant_messages: `
        SELECT DATE(m.created_at) AS day, t.subject_id, COUNT(*) AS count
        FROM api_chatmessage m
        INNER JOIN api_chatthread t ON t.id = m.thread_id
        WHERE m.role = 'user' AND m.mode = 'assistant'
          AND m.created_at >= ? AND m.created_at < ?
          AND (? IS NULL OR t.subject_id = ?)
        GROUP BY DATE(m.created_at), t.subject_id
    `,
    ai_checker_evaluations: `
        SELECT
            DATE(e.created_at) AS day,
            COALESCE(t.subject_id, d.subject_id) AS subject_id,
            COUNT(*) AS count
        FROM api_aicheckerevaluation e
        LEFT JOIN api_chatthread t ON t.id = e.thread_id
        LEFT JOIN api_document d ON d.id = e.question_paper_id
        WHERE e.created_at >= ? AND e.created_at < ?
          AND (? IS NULL OR COALESCE(t.subject_id, d.subject_id) = ?)
        GROUP BY DATE(e.created_at), COALESCE(t.subject_id, d.subject_id)
    `,
    ai_checker_general: `
        SELECT
            DATE(e.created_at) AS day,
            COALESCE(t.subject_id, d.subject_id) AS subject_id,
            COUNT(*) AS count
        FROM api_aicheckerevaluation e
        LEFT JOIN api_chatthread t ON t.id = e.thread_id
        LEFT JOIN api_document d ON d.id = e.question_paper_id
        WHERE e.mode = 'general'
          AND e.created_at >= ? AND e.created_at < ?
          AND (? IS NULL OR COALESCE(t.subject_id, d.subject_id) = ?)
        GROUP BY DATE(e.created_at), COALESCE(t.subject_id, d.subject_id)
    `,
    ai_checker_past_paper: `
        SELECT
            DATE(e.created_at) AS day,
            COALESCE(t.subject_id, d.subject_id) AS subject_id,
            COUNT(*) AS count
        FROM api_aicheckerevaluation e
        LEFT JOIN api_chatthread t ON t.id = e.thread_id
        LEFT JOIN api_document d ON d.id = e.question_paper_id
        WHERE e.mode = 'past_paper'
          AND e.created_at >= ? AND e.created_at < ?
          AND (? IS NULL OR COALESCE(t.subject_id, d.subject_id) = ?)
        GROUP BY DATE(e.created_at), COALESCE(t.subject_id, d.subject_id)
    `,
    mcq_wrong_review: `
        SELECT DATE(m.created_at) AS day, t.subject_id, COUNT(*) AS count
        FROM api_chatmessage m
        INNER JOIN api_chatthread t ON t.id = m.thread_id
        WHERE m.role = 'user' AND m.mode = 'mcq_review'
          AND m.created_at >= ? AND m.created_at < ?
          AND (? IS NULL OR t.subject_id = ?)
        GROUP BY DATE(m.created_at), t.subject_id
    `,
    study_sessions_created: `
        SELECT DATE(s.created_at) AS day, s.subject_id, COUNT(*) AS count
        FROM api_studysession s
        WHERE s.created_at >= ? AND s.created_at < ?
          AND (? IS NULL OR s.subject_id = ?)
        GROUP BY DATE(s.created_at), s.subject_id
    `,
    flashcard_study_sessions: `
        SELECT DATE(ss.started_at) AS day, fs.subject_id, COUNT(*) AS count
        FROM api_flashcardstudysession ss
        INNER JOIN api_flashcardset fs ON fs.id = ss.set_id
        WHERE ss.started_at >= ? AND ss.started_at < ?
          AND (? IS NULL OR fs.subject_id = ?)
        GROUP BY DATE(ss.started_at), fs.subject_id
    `,
    quiz_attempts: `
        SELECT DATE(a.started_at) AS day, q.subject_id, COUNT(*) AS count
        FROM api_quizattempt a
        INNER JOIN api_quiz q ON q.id = a.quiz_id
        WHERE a.started_at >= ? AND a.started_at < ?
          AND (? IS NULL OR q.subject_id = ?)
        GROUP BY DATE(a.started_at), q.subject_id
    `,
    flashcard_reviews: `
        SELECT DATE(r.reviewed_at) AS day, fs.subject_id, COUNT(*) AS count
        FROM api_flashcardreviewevent r
        INNER JOIN api_flashcardstudysession ss ON ss.id = r.session_id
        INNER JOIN api_flashcardset fs ON fs.id = ss.set_id
        WHERE r.reviewed_at >= ? AND r.reviewed_at < ?
          AND (? IS NULL OR fs.subject_id = ?)
        GROUP BY DATE(r.reviewed_at), fs.subject_id
    `,
};

export const findAnalyticsSubjects = async () => executeQuery(
    `
    SELECT id, name, code, level, exam_board
    FROM api_subject
    WHERE is_active = 1
    ORDER BY name ASC
    `
);

export const findFeatureCounts = async (
    feature,
    startDate,
    endDate,
    subjectId
) => executeQuery(
    FEATURE_QUERIES[feature],
    [startDate, endDate, subjectId, subjectId]
);

export const findActiveUserDays = async (
    startDate,
    endDate,
    subjectId
) => {
    const segmentParams = [];
    for (let index = 0; index < 8; index++) {
        segmentParams.push(startDate, endDate);
    }
    const rows = await executeQuery(
        `
        SELECT DISTINCT activity.day, activity.user_id
        FROM (
            SELECT DATE(created_at) AS day, user_id, subject_id
            FROM api_quiz
            WHERE created_at >= ? AND created_at < ?
            UNION ALL
            SELECT DATE(created_at), user_id, subject_id
            FROM api_flashcardset
            WHERE created_at >= ? AND created_at < ?
            UNION ALL
            SELECT DATE(m.created_at), t.user_id, t.subject_id
            FROM api_chatmessage m
            INNER JOIN api_chatthread t ON t.id = m.thread_id
            WHERE m.role = 'user' AND m.created_at >= ? AND m.created_at < ?
            UNION ALL
            SELECT DATE(created_at), user_id, subject_id
            FROM api_studysession
            WHERE created_at >= ? AND created_at < ?
            UNION ALL
            SELECT DATE(a.started_at), a.user_id, q.subject_id
            FROM api_quizattempt a
            INNER JOIN api_quiz q ON q.id = a.quiz_id
            WHERE a.started_at >= ? AND a.started_at < ?
            UNION ALL
            SELECT DATE(ss.started_at), ss.user_id, fs.subject_id
            FROM api_flashcardstudysession ss
            INNER JOIN api_flashcardset fs ON fs.id = ss.set_id
            WHERE ss.started_at >= ? AND ss.started_at < ?
            UNION ALL
            SELECT
                DATE(e.created_at), t.user_id,
                COALESCE(t.subject_id, d.subject_id)
            FROM api_aicheckerevaluation e
            LEFT JOIN api_chatthread t ON t.id = e.thread_id
            LEFT JOIN api_document d ON d.id = e.question_paper_id
            WHERE e.created_at >= ? AND e.created_at < ?
            UNION ALL
            SELECT DATE(r.reviewed_at), ss.user_id, fs.subject_id
            FROM api_flashcardreviewevent r
            INNER JOIN api_flashcardstudysession ss ON ss.id = r.session_id
            INNER JOIN api_flashcardset fs ON fs.id = ss.set_id
            WHERE r.reviewed_at >= ? AND r.reviewed_at < ?
        ) activity
        WHERE (? IS NULL OR activity.subject_id = ?)
          AND activity.user_id IS NOT NULL
        `,
        [...segmentParams, subjectId, subjectId]
    );
    return rows;
};

export const findTopUsers = async (
    startDate,
    endDate,
    limit,
    offset
) => {
    const params = [];
    for (let index = 0; index < 4; index++) {
        params.push(startDate, endDate);
    }
    return executeQuery(
        `
        SELECT
            u.id AS user_id,
            u.email,
            SUM(activity.quizzes) AS quizzes,
            SUM(activity.flashcards) AS flashcards,
            SUM(activity.chats) AS chats,
            SUM(activity.sessions) AS sessions,
            SUM(
                activity.quizzes + activity.flashcards +
                activity.chats + activity.sessions
            ) AS total_actions
        FROM (
            SELECT user_id, COUNT(*) AS quizzes, 0 AS flashcards, 0 AS chats, 0 AS sessions
            FROM api_quiz
            WHERE created_at >= ? AND created_at < ?
            GROUP BY user_id
            UNION ALL
            SELECT user_id, 0, COUNT(*), 0, 0
            FROM api_flashcardset
            WHERE is_ai_generated = 1 AND created_at >= ? AND created_at < ?
            GROUP BY user_id
            UNION ALL
            SELECT t.user_id, 0, 0, COUNT(*), 0
            FROM api_chatmessage m
            INNER JOIN api_chatthread t ON t.id = m.thread_id
            WHERE m.role = 'user' AND m.created_at >= ? AND m.created_at < ?
            GROUP BY t.user_id
            UNION ALL
            SELECT user_id, 0, 0, 0, COUNT(*)
            FROM api_studysession
            WHERE created_at >= ? AND created_at < ?
            GROUP BY user_id
        ) activity
        INNER JOIN api_user u ON u.id = activity.user_id
        GROUP BY u.id, u.email
        ORDER BY total_actions DESC, u.id ASC
        LIMIT ${Math.max(1, Number(limit) || 1)}
        OFFSET ${Math.max(0, Number(offset) || 0)}
        `,
        params
    );
};

export const countTopUsers = async (startDate, endDate) => {
    const rows = await executeQuery(
        `
        SELECT COUNT(DISTINCT user_id) AS count
        FROM (
            SELECT user_id FROM api_quiz WHERE created_at >= ? AND created_at < ?
            UNION
            SELECT user_id FROM api_flashcardset
            WHERE is_ai_generated = 1 AND created_at >= ? AND created_at < ?
            UNION
            SELECT t.user_id
            FROM api_chatmessage m
            INNER JOIN api_chatthread t ON t.id = m.thread_id
            WHERE m.role = 'user' AND m.created_at >= ? AND m.created_at < ?
            UNION
            SELECT user_id FROM api_studysession WHERE created_at >= ? AND created_at < ?
        ) users
        `,
        [
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
        ]
    );
    return Number(rows[0]?.count || 0);
};

export const findConversionFunnel = async (startDate, endDate) => {
    const rows = await executeQuery(
        `
        SELECT
            (SELECT COUNT(*) FROM api_user
             WHERE is_verified = 1 AND created_at >= ? AND created_at < ?) AS signups,
            (SELECT COUNT(DISTINCT t.user_id)
             FROM api_chatmessage m
             INNER JOIN api_chatthread t ON t.id = m.thread_id
             WHERE m.role = 'user' AND m.created_at >= ? AND m.created_at < ?) AS first_chat,
            (SELECT COUNT(DISTINCT user_id) FROM api_quiz
             WHERE created_at >= ? AND created_at < ?) AS quiz_generated,
            (SELECT COUNT(DISTINCT user_id) FROM api_quizattempt
             WHERE submitted_at IS NOT NULL AND started_at >= ? AND started_at < ?) AS quiz_completed
        `,
        [
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
            startDate, endDate,
        ]
    );
    return rows[0];
};

export const findVerifiedSignups = async (startDate, endDate) => (
    executeQuery(
        `
        SELECT id, DATE(created_at) AS signup_day
        FROM api_user
        WHERE is_verified = 1 AND created_at >= ? AND created_at < ?
        `,
        [startDate, endDate]
    )
);

export const hasUserActivity = async (
    userId,
    startDate,
    endDate
) => {
    const rows = await executeQuery(
        `
        SELECT 1
        FROM (
            SELECT user_id, created_at AS activity_at FROM api_quiz
            UNION ALL
            SELECT user_id, created_at FROM api_flashcardset
            UNION ALL
            SELECT t.user_id, m.created_at
            FROM api_chatmessage m
            INNER JOIN api_chatthread t ON t.id = m.thread_id
            UNION ALL
            SELECT user_id, created_at FROM api_studysession
            UNION ALL
            SELECT user_id, started_at FROM api_quizattempt
        ) activity
        WHERE activity.user_id = ?
          AND activity.activity_at >= ?
          AND activity.activity_at < ?
        LIMIT 1
        `,
        [userId, startDate, endDate]
    );
    return rows.length > 0;
};
