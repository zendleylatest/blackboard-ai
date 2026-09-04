import { executeQuery } from "../utils/databaseHelper.js";

export const findUserDashboardProfile = async (userId) => {
    const rows = await executeQuery(
        `
        SELECT
            u.id, u.username, u.email, u.is_verified, u.role,
            u.auth_provider, u.profile_completed, u.created_at, u.last_login,
            p.full_name, p.age, p.class_level, p.exam_board, p.profile_pic_url
        FROM api_user u
        LEFT JOIN api_userprofile p ON p.user_id = u.id
        WHERE u.id = ?
        LIMIT 1
        `,
        [userId]
    );

    return rows[0] || null;
};

export const findAllActiveSubjects = async () => executeQuery(
    `
    SELECT id, name, code, level, exam_board, description, is_active
    FROM api_subject
    WHERE is_active = 1
    ORDER BY name ASC
    `
);

export const findEnrolledSubjects = async (userId) => executeQuery(
    `
    SELECT s.id, s.name, s.code, s.level, s.exam_board, s.description, s.is_active
    FROM api_usersubject us
    INNER JOIN api_subject s ON s.id = us.subject_id
    WHERE us.user_id = ? AND s.is_active = 1
    ORDER BY s.name ASC
    `,
    [userId]
);

export const findRecentDashboardDocuments = async (userId) => executeQuery(
    `
    SELECT
        d.id, d.title, d.description, d.document_type, d.year,
        d.file_url, d.file_size_mb, d.download_count, d.created_at,
        d.subject_id, d.paper, d.series, d.variant, d.gcs_key,
        s.name AS subject_name, s.code AS subject_code,
        s.level AS subject_level, s.exam_board AS subject_exam_board
    FROM api_document d
    INNER JOIN api_subject s ON s.id = d.subject_id
    INNER JOIN api_usersubject us
        ON us.subject_id = d.subject_id AND us.user_id = ?
    ORDER BY d.created_at DESC
    LIMIT 5
    `,
    [userId]
);

export const findRecentDashboardQuizzes = async (userId) => executeQuery(
    `
    SELECT
        q.id, q.title, q.description, q.time_limit_minutes,
        q.total_questions, q.passing_score, q.is_active,
        q.created_at, q.subject_id,
        s.name AS subject_name, s.code AS subject_code
    FROM api_mcqquiz q
    INNER JOIN api_subject s ON s.id = q.subject_id
    INNER JOIN api_usersubject us
        ON us.subject_id = q.subject_id AND us.user_id = ?
    WHERE q.is_active = 1
    ORDER BY q.created_at DESC
    LIMIT 5
    `,
    [userId]
);

export const findProgressSummary = async (userId) => executeQuery(
    `
    SELECT
        s.id AS subject_id,
        s.name AS subject_name,
        COALESCE(p.total_time_spent_minutes, 0) AS total_time_spent,
        p.last_activity,
        COUNT(DISTINCT pd.document_id) AS documents_viewed,
        COUNT(DISTINCT pq.mcqquiz_id) AS quizzes_completed
    FROM api_usersubject us
    INNER JOIN api_subject s ON s.id = us.subject_id
    LEFT JOIN api_userprogress p
        ON p.user_id = us.user_id AND p.subject_id = us.subject_id
    LEFT JOIN api_userprogress_documents_viewed pd
        ON pd.userprogress_id = p.id
    LEFT JOIN api_userprogress_quizzes_completed pq
        ON pq.userprogress_id = p.id
    WHERE us.user_id = ?
    GROUP BY
        s.id, s.name, p.total_time_spent_minutes, p.last_activity
    `,
    [userId]
);

export const findUserStats = async (userId) => {
    const [attemptRows, sessionRows, reviewRows] = await Promise.all([
        executeQuery(
            `
            SELECT
                COUNT(*) AS quizzes_taken,
                COALESCE(SUM(score), 0) AS score_sum,
                COALESCE(SUM(total), 0) AS total_sum
            FROM api_quizattempt
            WHERE user_id = ? AND submitted_at IS NOT NULL
            `,
            [userId]
        ),
        executeQuery(
            `
            SELECT COUNT(*) AS completed
            FROM api_flashcardstudysession
            WHERE user_id = ? AND completed_at IS NOT NULL
            `,
            [userId]
        ),
        executeQuery(
            `
            SELECT
                COUNT(*) AS reviews,
                COUNT(DISTINCT e.card_id) AS unique_cards
            FROM api_flashcardreviewevent e
            INNER JOIN api_flashcardstudysession ss ON ss.id = e.session_id
            WHERE ss.user_id = ?
            `,
            [userId]
        ),
    ]);

    return {
        attempts: attemptRows[0],
        sessions: sessionRows[0],
        reviews: reviewRows[0],
    };
};

export const upsertAdminUser = async ({
    email,
    password,
    isSuperuser,
}) => {
    await executeQuery(
        `
        INSERT INTO api_user (
            password, is_superuser, username, first_name, last_name,
            is_staff, is_active, date_joined, email, is_verified,
            login_attempts, role, created_at, auth_provider,
            profile_completed
        )
        VALUES (?, ?, ?, '', '', 1, 1, NOW(), ?, 1, 0, 'admin', NOW(), 'email', 1)
        ON DUPLICATE KEY UPDATE
            password = VALUES(password),
            is_superuser = VALUES(is_superuser),
            username = VALUES(username),
            is_staff = 1,
            is_active = 1,
            is_verified = 1,
            role = 'admin',
            profile_completed = 1
        `,
        [password, isSuperuser ? 1 : 0, email, email]
    );
    const rows = await executeQuery(
        "SELECT id, email FROM api_user WHERE email = ? LIMIT 1",
        [email]
    );
    return rows[0];
};

export const ensureAdminProfile = async ({
    userId,
    fullName,
    age,
    classLevel,
    examBoard,
}) => executeQuery(
    `
    INSERT INTO api_userprofile (
        full_name, age, class_level, exam_board, profile_pic_url, user_id
    )
    VALUES (?, ?, ?, ?, NULL, ?)
    ON DUPLICATE KEY UPDATE user_id = user_id
    `,
    [fullName, age, classLevel, examBoard, userId]
);
