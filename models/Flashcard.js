import { executeQuery } from "../utils/databaseHelper.js";

export const findActiveSubjectById = async (
    subjectId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT id, name, code, level, exam_board, description, is_active
        FROM api_subject
        WHERE id = ? AND is_active = 1
        LIMIT 1
        `,
        [subjectId],
        connection
    );

    return rows[0] || null;
};

export const findSubjectById = async (
    subjectId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT id, name, code, level, exam_board, description, is_active
        FROM api_subject
        WHERE id = ?
        LIMIT 1
        `,
        [subjectId],
        connection
    );

    return rows[0] || null;
};

export const isUserEnrolledInSubject = async (
    userId,
    subjectId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT 1
        FROM api_usersubject
        WHERE user_id = ? AND subject_id = ?
        LIMIT 1
        `,
        [userId, subjectId],
        connection
    );

    return rows.length > 0;
};

export const findFlashcardSetsBySubject = async (
    userId,
    subjectId,
    connection = null
) => executeQuery(
    `
    SELECT
        id, title, topic, difficulty_level, is_ai_generated,
        card_count, reviews_today, reviews_total, completed_today,
        completed_total, last_completed_at, last_studied, mastery,
        streak_count, created_at, updated_at,
        (
            SELECT CASE
                WHEN ss.total_cards > 0
                THEN ss.easy_count / ss.total_cards
                ELSE 0
            END
            FROM api_flashcardstudysession ss
            WHERE ss.set_id = api_flashcardset.id
              AND ss.completed_at IS NOT NULL
            ORDER BY ss.completed_at DESC
            LIMIT 1
        ) AS last_score
    FROM api_flashcardset
    WHERE user_id = ? AND subject_id = ?
    ORDER BY created_at DESC
    `,
    [userId, subjectId],
    connection
);

export const findFlashcardSetForUser = async (
    setId,
    userId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT
            fs.id, fs.title, fs.description, fs.topic,
            fs.difficulty_level, fs.is_ai_generated, fs.card_count,
            fs.reviews_today, fs.reviews_total, fs.completed_today,
            fs.completed_total, fs.last_completed_at, fs.last_studied,
            fs.mastery, fs.streak_count, fs.last_streak_date,
            fs.sources, fs.created_at, fs.updated_at,
            fs.subject_id, fs.user_id,
            s.name AS subject_name, s.code AS subject_code,
            s.level AS subject_level, s.exam_board AS subject_exam_board,
            s.description AS subject_description,
            s.is_active AS subject_is_active
        FROM api_flashcardset fs
        LEFT JOIN api_subject s ON s.id = fs.subject_id
        WHERE fs.id = ? AND fs.user_id = ?
        LIMIT 1
        `,
        [setId, userId],
        connection
    );

    return rows[0] || null;
};

export const findFlashcardsBySet = async (
    setId,
    connection = null
) => executeQuery(
    `
    SELECT
        id, subject_id, set_id, front_text, back_text,
        difficulty_level, difficulty, leitner_box, times_reviewed,
        last_reviewed_at, sources, created_at
    FROM api_flashcard
    WHERE set_id = ?
    ORDER BY id ASC
    `,
    [setId],
    connection
);

export const createFlashcardSet = async (
    {
        id,
        userId,
        subjectId,
        title,
        description,
        topic,
        difficultyLevel,
        isAiGenerated,
        sources,
        createdAt,
    },
    connection
) => {
    await executeQuery(
        `
        INSERT INTO api_flashcardset (
            id, title, description, topic, difficulty_level,
            is_ai_generated, card_count, reviews_today, reviews_total,
            completed_today, completed_total, mastery, streak_count,
            subject_id, user_id, sources, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?)
        `,
        [
            id,
            title,
            description || "",
            topic || "",
            difficultyLevel,
            isAiGenerated ? 1 : 0,
            subjectId,
            userId,
            JSON.stringify(sources || []),
            createdAt,
            createdAt,
        ],
        connection
    );
};

export const createFlashcard = async (
    {
        subjectId,
        setId,
        frontText,
        backText,
        difficultyLevel,
        sources,
        createdAt,
    },
    connection
) => {
    const result = await executeQuery(
        `
        INSERT INTO api_flashcard (
            subject_id, set_id, front_text, back_text,
            difficulty_level, difficulty, leitner_box,
            times_reviewed, sources, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
        `,
        [
            subjectId,
            setId,
            frontText,
            backText,
            difficultyLevel,
            difficultyLevel,
            JSON.stringify(sources || []),
            createdAt,
        ],
        connection
    );

    return result.insertId;
};

export const updateSetCardCount = async (
    setId,
    count,
    connection = null
) => {
    await executeQuery(
        "UPDATE api_flashcardset SET card_count = ? WHERE id = ?",
        [count, setId],
        connection
    );
};

export const deleteFlashcardSet = async (
    setId,
    userId,
    connection = null
) => {
    const result = await executeQuery(
        "DELETE FROM api_flashcardset WHERE id = ? AND user_id = ?",
        [setId, userId],
        connection
    );

    return result.affectedRows > 0;
};

export const deleteFlashcardSetRelations = async (
    setId,
    connection
) => {
    await executeQuery(
        `
        DELETE e
        FROM api_flashcardreviewevent e
        INNER JOIN api_flashcardstudysession ss ON ss.id = e.session_id
        WHERE ss.set_id = ?
        `,
        [setId],
        connection
    );
    await executeQuery(
        "DELETE FROM api_flashcardstudysession WHERE set_id = ?",
        [setId],
        connection
    );
    await executeQuery(
        "DELETE FROM api_flashcard WHERE set_id = ?",
        [setId],
        connection
    );
};

export const createStudySession = async (
    { userId, setId, totalCards, startedAt },
    connection
) => {
    const result = await executeQuery(
        `
        INSERT INTO api_flashcardstudysession
            (started_at, total_cards, easy_count, hard_count,
             duration_sec, set_id, user_id)
        VALUES (?, ?, 0, 0, 0, ?, ?)
        `,
        [startedAt, totalCards, setId, userId],
        connection
    );

    return result.insertId;
};

export const findStudySessionForUser = async (
    sessionId,
    setId,
    userId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT id, started_at, completed_at, total_cards,
               easy_count, hard_count, duration_sec, set_id, user_id
        FROM api_flashcardstudysession
        WHERE id = ? AND set_id = ? AND user_id = ?
        LIMIT 1
        `,
        [sessionId, setId, userId],
        connection
    );

    return rows[0] || null;
};

export const findSessionByIdForUser = async (
    sessionId,
    setId,
    userId,
    connection = null
) => findStudySessionForUser(sessionId, setId, userId, connection);

export const createReviewEvent = async (
    { sessionId, cardId, result, reviewedAt },
    connection
) => {
    await executeQuery(
        `
        INSERT INTO api_flashcardreviewevent
            (result, reviewed_at, card_id, session_id)
        VALUES (?, ?, ?, ?)
        `,
        [result, reviewedAt, cardId, sessionId],
        connection
    );
};

export const findFlashcardInSet = async (
    cardId,
    setId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT id, subject_id, set_id, front_text, back_text,
               difficulty_level, difficulty, leitner_box,
               times_reviewed, last_reviewed_at, sources, created_at
        FROM api_flashcard
        WHERE id = ? AND set_id = ?
        LIMIT 1
        `,
        [cardId, setId],
        connection
    );

    return rows[0] || null;
};

export const updateReviewedCard = async (
    cardId,
    result,
    reviewedAt,
    connection
) => {
    await executeQuery(
        `
        UPDATE api_flashcard
        SET times_reviewed = times_reviewed + 1,
            last_reviewed_at = ?,
            leitner_box = CASE
                WHEN ? = 'easy' THEN LEAST(5, leitner_box + 1)
                ELSE GREATEST(1, leitner_box - 1)
            END
        WHERE id = ?
        `,
        [reviewedAt, result, cardId],
        connection
    );
};

export const findAverageLeitnerBox = async (
    setId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT AVG(leitner_box) AS average_box
        FROM api_flashcard
        WHERE set_id = ?
        `,
        [setId],
        connection
    );

    return Number(rows[0]?.average_box || 1);
};

export const updateSetAfterReview = async (
    { setId, mastery },
    connection
) => {
    await executeQuery(
        `
        UPDATE api_flashcardset
        SET reviews_total = reviews_total + 1,
            reviews_today = reviews_today + 1,
            mastery = ?
        WHERE id = ?
        `,
        [mastery, setId],
        connection
    );
};

export const updateSetLastStudied = async (
    setId,
    studiedAt,
    connection
) => {
    await executeQuery(
        "UPDATE api_flashcardset SET last_studied = ? WHERE id = ?",
        [studiedAt, setId],
        connection
    );
};

export const findCompletedSessions = async (
    setId,
    userId,
    connection = null
) => executeQuery(
    `
    SELECT id, completed_at, started_at, total_cards,
           easy_count, hard_count, duration_sec
    FROM api_flashcardstudysession
    WHERE set_id = ? AND user_id = ? AND completed_at IS NOT NULL
    ORDER BY completed_at DESC, started_at DESC
    `,
    [setId, userId],
    connection
);

export const findWrongEvents = async (
    sessionId,
    connection = null
) => executeQuery(
    `
    SELECT
        c.id, c.subject_id, c.set_id, c.front_text, c.back_text,
        c.difficulty_level, c.difficulty, c.leitner_box,
        c.times_reviewed, c.last_reviewed_at, c.sources, c.created_at
    FROM api_flashcardreviewevent e
    INNER JOIN api_flashcard c ON c.id = e.card_id
    WHERE e.session_id = ? AND e.result = 'hard'
    ORDER BY e.id ASC
    `,
    [sessionId],
    connection
);

export const findReviewEventsBySession = async (
    sessionId,
    connection = null
) => executeQuery(
    `
    SELECT result
    FROM api_flashcardreviewevent
    WHERE session_id = ?
    ORDER BY id ASC
    `,
    [sessionId],
    connection
);

export const completeStudySession = async (
    { sessionId, completedAt, durationSec, easyCount, hardCount },
    connection
) => {
    await executeQuery(
        `
        UPDATE api_flashcardstudysession
        SET completed_at = ?, duration_sec = ?, easy_count = ?, hard_count = ?
        WHERE id = ? AND completed_at IS NULL
        `,
        [completedAt, durationSec, easyCount, hardCount, sessionId],
        connection
    );
};

export const updateSetAfterCompletion = async (
    {
        setId,
        completedAt,
        mastery,
        completedToday,
        streakCount,
        streakDate,
    },
    connection
) => {
    await executeQuery(
        `
        UPDATE api_flashcardset
        SET completed_total = completed_total + 1,
            completed_today = ?,
            last_completed_at = ?,
            last_studied = ?,
            mastery = ?,
            streak_count = ?,
            last_streak_date = ?
        WHERE id = ?
        `,
        [
            completedToday ? 1 : 0,
            completedAt,
            completedAt,
            mastery,
            streakCount,
            streakDate,
            setId,
        ],
        connection
    );
};

export const findSetLatestCompletedSession = async (
    setId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT total_cards, easy_count
        FROM api_flashcardstudysession
        WHERE set_id = ? AND completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 1
        `,
        [setId],
        connection
    );

    return rows[0] || null;
};
