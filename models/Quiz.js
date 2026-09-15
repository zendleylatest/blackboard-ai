import { executeQuery } from "../utils/databaseHelper.js";

const normalizeUuid = (value) => (
    String(value || "").replace(/-/g, "").toLowerCase()
);


export const findSubjectById = async (subjectId) => {
    const rows = await executeQuery(
        `
        SELECT
            id,
            name,
            code,
            is_active
        FROM api_subject
        WHERE id = ?
        LIMIT 1
        `,
        [subjectId]
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
        WHERE user_id = ?
          AND subject_id = ?
        LIMIT 1
        `,
        [userId, subjectId],
        connection
    );

    return rows.length > 0;
};

export const findUserQuizzesBySubject = async (
    userId,
    subjectId
) => {
    return executeQuery(
        `
        SELECT
            id,
            title,
            prompt,
            question_count,
            duration_sec,
            times_attempted,
            last_score,
            last_attempted_at,
            created_at,
            updated_at,
            subject_id,
            user_id,
            difficulty,
            sources,
            streak_count,
            last_streak_date
        FROM api_quiz
        WHERE user_id = ?
          AND subject_id = ?
        ORDER BY updated_at DESC
        `,
        [userId, subjectId]
    );
};

export const findQuizByIdForUser = async (
    quizId,
    userId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT
            q.id,
            q.title,
            q.prompt,
            q.question_count,
            q.duration_sec,
            q.times_attempted,
            q.last_score,
            q.last_attempted_at,
            q.created_at,
            q.updated_at,
            q.subject_id,
            q.user_id,
            q.difficulty,
            q.sources,
            q.streak_count,
            q.last_streak_date,

            s.id AS subject_id,
            s.name AS subject_name,
            s.code AS subject_code,
            s.is_active AS subject_is_active

        FROM api_quiz q
        LEFT JOIN api_subject s
            ON s.id = q.subject_id

        WHERE q.id = ?
          AND q.user_id = ?

        LIMIT 1
        `,
        [normalizeUuid(quizId), userId],
        connection
    );

    return rows[0] || null;
};

export const findQuizQuestions = async (
    quizId,
    connection = null
) => {
    return executeQuery(
        `
        SELECT
            id,
            stem,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_index,
            explanation,
            quiz_id,
            sources
        FROM api_quizquestion
        WHERE quiz_id = ?
        ORDER BY id ASC
        `,
        [normalizeUuid(quizId)],
        connection
    );
};

export const findQuizQuestionById = async (
    questionId,
    quizId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT
            id,
            stem,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_index,
            explanation,
            quiz_id,
            sources
        FROM api_quizquestion
        WHERE id = ?
          AND quiz_id = ?
        LIMIT 1
        `,
        [questionId, normalizeUuid(quizId)],
        connection
    );

    return rows[0] || null;
};

export const createQuizAttempt = async (
    {
        id,
        quizId,
        userId,
        total,
        startedAt,
    },
    connection
) => {
    await executeQuery(
        `
        INSERT INTO api_quizattempt (
            id,
            started_at,
            submitted_at,
            duration_sec,
            score,
            total,
            quiz_id,
            user_id,
            wrong_reviewed_at
        )
        VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?, NULL)
        `,
        [
            normalizeUuid(id),
            startedAt,
            total,
            normalizeUuid(quizId),
            userId,
        ],
        connection
    );
};

export const findAttemptByIdForUser = async (
    attemptId,
    userId,
    connection = null
) => {
    const rows = await executeQuery(
        `
        SELECT
            a.id,
            a.started_at,
            a.submitted_at,
            a.duration_sec,
            a.score,
            a.total,
            a.quiz_id,
            a.user_id,
            a.wrong_reviewed_at,

            q.title AS quiz_title,
            q.duration_sec AS quiz_duration_sec,
            q.question_count AS quiz_question_count,
            q.sources AS quiz_sources,
            q.streak_count AS quiz_streak_count,
            q.last_streak_date AS quiz_last_streak_date

        FROM api_quizattempt a
        INNER JOIN api_quiz q
            ON q.id = a.quiz_id

        WHERE a.id = ?
          AND a.user_id = ?

        LIMIT 1
        `,
        [normalizeUuid(attemptId), userId],
        connection
    );

    return rows[0] || null;
};

export const upsertQuizAnswer = async (
    {
        attemptId,
        questionId,
        choiceIndex,
    },
    connection
) => {
    await executeQuery(
        `
        INSERT INTO api_quizanswer (
            choice_index,
            is_correct,
            attempt_id,
            question_id
        )
        VALUES (?, NULL, ?, ?)
        ON DUPLICATE KEY UPDATE
            choice_index = VALUES(choice_index),
            is_correct = NULL
        `,
        [
            choiceIndex ?? null,
            normalizeUuid(attemptId),
            questionId,
        ],
        connection
    );
};

export const createMissingAttemptAnswers = async (
    {
        attemptId,
        quizId,
    },
    connection
) => {
    await executeQuery(
        `
        INSERT INTO api_quizanswer (
            choice_index,
            is_correct,
            attempt_id,
            question_id
        )
        SELECT
            NULL,
            NULL,
            ?,
            q.id
        FROM api_quizquestion q
        LEFT JOIN api_quizanswer a
            ON a.attempt_id = ?
           AND a.question_id = q.id
        WHERE q.quiz_id = ?
          AND a.id IS NULL
        `,
        [
            normalizeUuid(attemptId),
            normalizeUuid(attemptId),
            normalizeUuid(quizId),
        ],
        connection
    );
};

export const findAttemptAnswers = async (
    attemptId,
    connection = null
) => {
    return executeQuery(
        `
        SELECT
            a.id,
            a.choice_index,
            a.is_correct,
            a.attempt_id,
            a.question_id,

            q.stem,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
            q.correct_index,
            q.explanation,
            q.sources

        FROM api_quizanswer a
        INNER JOIN api_quizquestion q
            ON q.id = a.question_id

        WHERE a.attempt_id = ?
        ORDER BY q.id ASC
        `,
        [normalizeUuid(attemptId)],
        connection
    );
};

export const markAnswerCorrectness = async (
    answerId,
    isCorrect,
    connection
) => {
    await executeQuery(
        `
        UPDATE api_quizanswer
        SET is_correct = ?
        WHERE id = ?
        `,
        [isCorrect ? 1 : 0, answerId],
        connection
    );
};

export const submitAttempt = async (
    {
        attemptId,
        submittedAt,
        durationSec,
        score,
    },
    connection
) => {
    await executeQuery(
        `
        UPDATE api_quizattempt
        SET
            submitted_at = ?,
            duration_sec = ?,
            score = ?
        WHERE id = ?
          AND submitted_at IS NULL
        `,
        [
            submittedAt,
            durationSec,
            score,
            normalizeUuid(attemptId),
        ],
        connection
    );
};

export const updateQuizAggregates = async (
    {
        quizId,
        submittedAt,
        score,
        total,
        streakCount,
        streakDate,
    },
    connection
) => {
    await executeQuery(
        `
        UPDATE api_quiz
        SET
            times_attempted = times_attempted + 1,
            last_score = ?,
            last_attempted_at = ?,
            streak_count = ?,
            last_streak_date = ?
        WHERE id = ?
        `,
        [
            total > 0 ? score / total : 0,
            submittedAt,
            streakCount,
            streakDate,
            normalizeUuid(quizId),
        ],
        connection
    );
};

export const findSubmittedAttemptsByQuiz = async (
    quizId,
    userId
) => {
    return executeQuery(
        `
        SELECT
            id,
            started_at,
            submitted_at,
            duration_sec,
            score,
            total,
            quiz_id,
            user_id,
            wrong_reviewed_at
        FROM api_quizattempt
        WHERE quiz_id = ?
          AND user_id = ?
          AND submitted_at IS NOT NULL
        ORDER BY started_at DESC
        `,
        [normalizeUuid(quizId), userId]
    );
};

export const markWrongReviewComplete = async (
    attemptId,
    reviewedAt
) => {
    await executeQuery(
        `
        UPDATE api_quizattempt
        SET wrong_reviewed_at = ?
        WHERE id = ?
        `,
        [reviewedAt, normalizeUuid(attemptId)]
    );
};

export const createQuiz = async (
    {
        id,
        userId,
        subjectId,
        title,
        prompt,
        questionCount,
        durationSec,
        difficulty,
        sources,
        createdAt,
    },
    connection
) => {
    await executeQuery(
        `
        INSERT INTO api_quiz (
            id, title, prompt, question_count, duration_sec,
            times_attempted, last_score, last_attempted_at,
            created_at, updated_at, subject_id, user_id,
            difficulty, sources
        )
        VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?, ?, ?, ?)
        `,
        [
            normalizeUuid(id),
            title,
            prompt,
            questionCount,
            durationSec,
            createdAt,
            createdAt,
            subjectId,
            userId,
            difficulty,
            JSON.stringify(sources || []),
        ],
        connection
    );
};

export const createQuizQuestion = async (
    {
        quizId,
        stem,
        options,
        correctIndex,
        explanation,
        sources,
    },
    connection
) => {
    const result = await executeQuery(
        `
        INSERT INTO api_quizquestion (
            stem, option_a, option_b, option_c, option_d,
            correct_index, explanation, quiz_id, sources
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            stem,
            options[0],
            options[1],
            options[2],
            options[3],
            correctIndex,
            explanation || "",
            normalizeUuid(quizId),
            JSON.stringify(sources || []),
        ],
        connection
    );

    return result.insertId;
};
