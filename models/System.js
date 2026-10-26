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

export const findAllActiveSubjects = async (page = 1, limit = 20, search = '', level = '', examBoard = '') => {
    // LIMIT/OFFSET are inlined as sanitised integers: binding them through a
    // prepared statement (execute) fails on some MySQL versions with
    // "Incorrect arguments to mysqld_stmt_execute".
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (safePage - 1) * safeLimit;
    let query = `
        SELECT id, name, code, level, exam_board, description, is_active
        FROM api_subject
        WHERE is_active = 1
    `;
    const params = [];
    if (search) {
        query += ` AND (name LIKE ? OR code LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }
    if (level) {
        query += ` AND level = ?`;
        params.push(level);
    }
    if (examBoard) {
        query += ` AND exam_board = ?`;
        params.push(examBoard);
    }
    query += ` ORDER BY name ASC, id ASC LIMIT ${safeLimit} OFFSET ${offset}`;
    
    return executeQuery(query, params);
};

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

// Stats are scoped to the user's current class level (O / A): a quiz or
// flashcard set belongs to a subject, and every subject belongs to exactly
// one level, so quizzes taken at the other level are not counted.
export const findUserStats = async (userId) => {
    const profileRows = await executeQuery(
        "SELECT class_level FROM api_userprofile WHERE user_id = ? LIMIT 1",
        [userId]
    );
    const level = profileRows[0]?.class_level || null;
    // Lifetime stats: removing a subject must NOT lower them. Removed
    // subjects' totals are saved in api_userstatsarchive (added below), and
    // data from before that existed is simply still counted here.
    const levelClause = level ? "AND sub.level = ?" : "";
    const levelParams = level ? [level] : [];

    const [attemptRows, sessionRows, reviewRows] = await Promise.all([
        executeQuery(
            `
            SELECT
                COUNT(*) AS quizzes_taken,
                COALESCE(SUM(a.score), 0) AS score_sum,
                COALESCE(SUM(a.total), 0) AS total_sum
            FROM api_quizattempt a
            INNER JOIN api_quiz q ON q.id = a.quiz_id
            INNER JOIN api_subject sub ON sub.id = q.subject_id
            WHERE a.user_id = ? AND a.submitted_at IS NOT NULL ${levelClause}
            `,
            [userId, ...levelParams]
        ),
        executeQuery(
            `
            SELECT COUNT(*) AS completed
            FROM api_flashcardstudysession ss
            INNER JOIN api_flashcardset fs ON fs.id = ss.set_id
            INNER JOIN api_subject sub ON sub.id = fs.subject_id
            WHERE ss.user_id = ? AND ss.completed_at IS NOT NULL ${levelClause}
            `,
            [userId, ...levelParams]
        ),
        executeQuery(
            `
            SELECT
                COUNT(*) AS reviews,
                COUNT(DISTINCT e.card_id) AS unique_cards
            FROM api_flashcardreviewevent e
            INNER JOIN api_flashcardstudysession ss ON ss.id = e.session_id
            INNER JOIN api_flashcardset fs ON fs.id = ss.set_id
            INNER JOIN api_subject sub ON sub.id = fs.subject_id
            WHERE ss.user_id = ? ${levelClause}
            `,
            [userId, ...levelParams]
        ),
    ]);

    const attempts = { ...attemptRows[0] };
    const sessions = { ...sessionRows[0] };
    const reviews = { ...reviewRows[0] };

    // Add totals archived from subjects the user has since removed, so
    // removing a subject never lowers quizzes taken / flashcards studied /
    // average score.
    try {
        const archived = await executeQuery(
            `
            SELECT
                COALESCE(SUM(quizzes_taken), 0) AS quizzes_taken,
                COALESCE(SUM(score_sum), 0) AS score_sum,
                COALESCE(SUM(total_sum), 0) AS total_sum,
                COALESCE(SUM(flashcard_sessions), 0) AS flashcard_sessions,
                COALESCE(SUM(reviews), 0) AS reviews,
                COALESCE(SUM(unique_cards), 0) AS unique_cards
            FROM api_userstatsarchive
            WHERE user_id = ? ${level ? "AND level = ?" : ""}
            `,
            level ? [userId, level] : [userId]
        );
        const a = archived[0] || {};
        attempts.quizzes_taken = Number(attempts.quizzes_taken || 0) + Number(a.quizzes_taken || 0);
        attempts.score_sum = Number(attempts.score_sum || 0) + Number(a.score_sum || 0);
        attempts.total_sum = Number(attempts.total_sum || 0) + Number(a.total_sum || 0);
        sessions.completed = Number(sessions.completed || 0) + Number(a.flashcard_sessions || 0);
        reviews.reviews = Number(reviews.reviews || 0) + Number(a.reviews || 0);
        reviews.unique_cards = Number(reviews.unique_cards || 0) + Number(a.unique_cards || 0);
    } catch (error) {
        if (error.code !== "ER_NO_SUCH_TABLE") throw error;
    }

    return { attempts, sessions, reviews };
};

let statsArchiveReady = null;

// Created on demand (DDL must run outside a transaction).
export const ensureStatsArchiveTable = () => {
    statsArchiveReady ??= executeQuery(`
        CREATE TABLE IF NOT EXISTS api_userstatsarchive (
            user_id BIGINT NOT NULL,
            level VARCHAR(10) NOT NULL,
            quizzes_taken INT NOT NULL DEFAULT 0,
            score_sum INT NOT NULL DEFAULT 0,
            total_sum INT NOT NULL DEFAULT 0,
            flashcard_sessions INT NOT NULL DEFAULT 0,
            reviews INT NOT NULL DEFAULT 0,
            unique_cards INT NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, level)
        )
    `).catch((error) => {
        statsArchiveReady = null;
        throw error;
    });
    return statsArchiveReady;
};

// Fold one subject's totals into the archive. Call inside the unenroll
// transaction, BEFORE the subject's quizzes/flashcards are deleted.
export const archiveSubjectStats = async (connection, userId, subjectId, level) => {
    const [[att]] = await connection.execute(
        `SELECT COUNT(*) AS n, COALESCE(SUM(a.score),0) AS s, COALESCE(SUM(a.total),0) AS t
         FROM api_quizattempt a INNER JOIN api_quiz q ON q.id = a.quiz_id
         WHERE a.user_id = ? AND a.submitted_at IS NOT NULL AND q.subject_id = ?`,
        [userId, subjectId]
    );
    const [[ses]] = await connection.execute(
        `SELECT COUNT(*) AS n
         FROM api_flashcardstudysession ss INNER JOIN api_flashcardset fs ON fs.id = ss.set_id
         WHERE ss.user_id = ? AND ss.completed_at IS NOT NULL AND fs.subject_id = ?`,
        [userId, subjectId]
    );
    const [[rev]] = await connection.execute(
        `SELECT COUNT(*) AS n, COUNT(DISTINCT e.card_id) AS u
         FROM api_flashcardreviewevent e
         INNER JOIN api_flashcardstudysession ss ON ss.id = e.session_id
         INNER JOIN api_flashcardset fs ON fs.id = ss.set_id
         WHERE ss.user_id = ? AND fs.subject_id = ?`,
        [userId, subjectId]
    );
    await connection.execute(
        `INSERT INTO api_userstatsarchive
            (user_id, level, quizzes_taken, score_sum, total_sum, flashcard_sessions, reviews, unique_cards)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            quizzes_taken = quizzes_taken + VALUES(quizzes_taken),
            score_sum = score_sum + VALUES(score_sum),
            total_sum = total_sum + VALUES(total_sum),
            flashcard_sessions = flashcard_sessions + VALUES(flashcard_sessions),
            reviews = reviews + VALUES(reviews),
            unique_cards = unique_cards + VALUES(unique_cards)`,
        [userId, level || "", Number(att.n), Number(att.s), Number(att.t), Number(ses.n), Number(rev.n), Number(rev.u)]
    );
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
