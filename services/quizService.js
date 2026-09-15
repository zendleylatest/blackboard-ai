import crypto from "crypto";
import pool from "../config/database.js";
import HttpError from "../utils/httpError.js";

import {
    findSubjectById,
    isUserEnrolledInSubject,
    findUserQuizzesBySubject,
    findQuizByIdForUser,
    findQuizQuestions,
    findQuizQuestionById,
    createQuizAttempt,
    findAttemptByIdForUser,
    upsertQuizAnswer,
    createMissingAttemptAnswers,
    findAttemptAnswers,
    markAnswerCorrectness,
    submitAttempt,
    updateQuizAggregates,
    findSubmittedAttemptsByQuiz,
    markWrongReviewComplete as markWrongReviewCompleteModel,
    createQuiz,
    createQuizQuestion,
} from "../models/Quiz.js";
import { generateQuizWithAi } from "./quiz/quizAiService.js";
import {
    checkUsageLimit,
    incrementUsage,
} from "./usageLimitService.js";

const parseJson = (value, fallback = null) => {
    if (value === null || value === undefined) {
        return fallback;
    }

    if (typeof value === "object") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const formatUuid = (value) => {
    const raw = String(value || "").replace(/-/g, "");
    return raw.length === 32
        ? `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
        : value;
};

const toIsoOrNull = (value) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : date.toISOString();
};

const normalizeQuestion = (question) => ({
    id: question.id,
    stem: question.stem,
    options: [
        question.option_a,
        question.option_b,
        question.option_c,
        question.option_d,
    ],
    explanation: question.explanation,
    sources: parseJson(question.sources, []),
});

const hydrateSources = (
    questionSources,
    quizSources
) => {
    const sources = parseJson(quizSources, []) || [];

    const byChunk = new Map(
        sources
            .filter(
                (source) =>
                    source &&
                    typeof source === "object" &&
                    source.chunk_id
            )
            .map((source) => [
                Number(source.chunk_id),
                source,
            ])
    );

    const sourceIds = Array.isArray(questionSources)
        ? questionSources
        : [];

    let hydrated = sourceIds
        .filter((id) => Number.isInteger(Number(id)))
        .map((id) => byChunk.get(Number(id)))
        .filter(Boolean);

    if (hydrated.length === 0 && sources.length > 0) {
        const nonSyllabus = sources.filter(
            (source) =>
                (source?.document_type || "").toLowerCase() !==
                "syllabus"
        );

        hydrated = (
            nonSyllabus.length > 0
                ? nonSyllabus
                : sources
        ).slice(0, 3);
    }

    return hydrated;
};

const getUserQuizOrThrow = async (
    quizId,
    userId,
    connection = null
) => {
    const quiz = await findQuizByIdForUser(
        quizId,
        userId,
        connection
    );

    if (!quiz) {
        throw new HttpError(404, "Quiz not found.");
    }

    return quiz;
};

const getUserAttemptOrThrow = async (
    attemptId,
    userId,
    connection = null
) => {
    const attempt = await findAttemptByIdForUser(
        attemptId,
        userId,
        connection
    );

    if (!attempt) {
        throw new HttpError(404, "Attempt not found.");
    }

    return attempt;
};

export const listUserQuizzes = async (
    userId,
    subjectId
) => {
    const subject = await findSubjectById(subjectId);

    if (!subject) {
        throw new HttpError(404, "Subject not found.");
    }

    const enrolled = await isUserEnrolledInSubject(
        userId,
        subjectId
    );

    if (!enrolled) {
        throw new HttpError(
            403,
            "Not enrolled in subject."
        );
    }

    const quizzes = await findUserQuizzesBySubject(userId, subjectId);
    return quizzes.map((quiz) => ({
        ...quiz,
        id: formatUuid(quiz.id),
    }));
};

export const getQuizDetail = async (
    userId,
    quizId
) => {
    const quiz = await getUserQuizOrThrow(
        quizId,
        userId
    );

    const questions = await findQuizQuestions(
        quizId
    );

    const quizSources = parseJson(
        quiz.sources,
        []
    );

    return {
        id: formatUuid(quiz.id),
        subject: quiz.subject_id
            ? {
                  id: quiz.subject_id,
                  name: quiz.subject_name,
                  code: quiz.subject_code,
                  is_active: Boolean(
                      quiz.subject_is_active
                  ),
              }
            : null,
        title: quiz.title,
        prompt: quiz.prompt,
        question_count: quiz.question_count,
        duration_sec: quiz.duration_sec,
        difficulty: quiz.difficulty,
        times_attempted: quiz.times_attempted,
        last_score: quiz.last_score,
        last_attempted_at:
            quiz.last_attempted_at
                ? new Date(
                      quiz.last_attempted_at
                  ).toISOString()
                : null,
        created_at: new Date(
            quiz.created_at
        ).toISOString(),
        updated_at: new Date(
            quiz.updated_at
        ).toISOString(),
        questions: questions.map((question) => ({
            ...normalizeQuestion(question),
            sources: hydrateSources(
                parseJson(question.sources, []),
                quizSources
            ),
        })),
        sources: quizSources,
    };
};

export const startQuizAttempt = async (
    userId,
    quizId
) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const quiz = await getUserQuizOrThrow(
            quizId,
            userId,
            connection
        );

        const questions = await findQuizQuestions(
            quizId,
            connection
        );

        if (questions.length === 0) {
            throw new HttpError(
                400,
                "Cannot start an empty quiz."
            );
        }

        const attemptId = crypto
            .randomUUID()
            .replace(/-/g, "");

        const startedAt = new Date();

        await createQuizAttempt(
            {
                id: attemptId,
                quizId,
                userId,
                total: questions.length,
                startedAt,
            },
            connection
        );

        await connection.commit();

        return {
            attempt_id: formatUuid(attemptId),
            started_at: startedAt.toISOString(),
            duration_sec: quiz.duration_sec,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export const submitQuizAnswer = async (
    userId,
    attemptId,
    questionId,
    choiceIndex
) => {
    const attempt = await getUserAttemptOrThrow(
        attemptId,
        userId
    );

    if (attempt.submitted_at) {
        throw new HttpError(
            400,
            "Quiz already submitted."
        );
    }

    const question = await findQuizQuestionById(
        questionId,
        attempt.quiz_id
    );

    if (!question) {
        throw new HttpError(
            404,
            "Question not found for this quiz."
        );
    }

    await upsertQuizAnswer({
        attemptId,
        questionId,
        choiceIndex:
            choiceIndex === undefined
                ? null
                : choiceIndex,
    });

    return {
        success: true,
    };
};

export const submitQuizAttempt = async (
    userId,
    attemptId
) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const attempt = await getUserAttemptOrThrow(
            attemptId,
            userId,
            connection
        );

        if (attempt.submitted_at) {
            throw new HttpError(
                400,
                "Quiz already submitted."
            );
        }

        const now = new Date();

        const startedAt = new Date(attempt.started_at);
        const startedAtMs = startedAt.getTime();
        const durationSec = Number.isNaN(startedAtMs)
            ? 0
            : Math.max(
                  0,
                  Math.floor(
                      (now.getTime() - startedAtMs) /
                          1000
                  )
              );

        await createMissingAttemptAnswers(
            {
                attemptId,
                quizId: attempt.quiz_id,
            },
            connection
        );

        const answers = await findAttemptAnswers(
            attemptId,
            connection
        );

        let score = 0;

        for (const answer of answers) {
            const isCorrect =
                answer.choice_index !== null &&
                Number(answer.choice_index) ===
                    Number(answer.correct_index);

            if (isCorrect) {
                score++;
            }

            await markAnswerCorrectness(
                answer.id,
                isCorrect,
                connection
            );
        }

        const total = Number(attempt.total);

        await submitAttempt(
            {
                attemptId,
                submittedAt: now,
                durationSec,
                score,
            },
            connection
        );

        await updateQuizAggregates(
            {
                quizId: attempt.quiz_id,
                submittedAt: now,
                score,
                total,
            },
            connection
        );

        const finalAnswers =
            await findAttemptAnswers(
                attemptId,
                connection
            );

        const result = {
            id: formatUuid(attempt.id),
            score,
            total,
            time_sec: durationSec,
            score_percentage:
                total > 0
                    ? Math.floor(
                          (score / total) *
                              100
                      )
                    : 0,
            submitted_at:
                now.toISOString(),
            per_question:
                finalAnswers.map((answer) => ({
                    id: answer.question_id,
                    stem: answer.stem,
                    user_choice:
                        answer.choice_index,
                    correct_choice:
                        answer.correct_index,
                    correct: Boolean(
                        answer.is_correct
                    ),
                    explanation:
                        answer.explanation ||
                        "No explanation provided.",
                    options: [
                        answer.option_a,
                        answer.option_b,
                        answer.option_c,
                        answer.option_d,
                    ],
                    sources: hydrateSources(
                        parseJson(
                            answer.sources,
                            []
                        ),
                        attempt.quiz_sources
                    ),
                })),
        };

        await connection.commit();

        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export const getQuizAttempts = async (
    userId,
    quizId
) => {
    await getUserQuizOrThrow(
        quizId,
        userId
    );

    const attempts = await findSubmittedAttemptsByQuiz(quizId, userId);
    return attempts.map((attempt) => ({
        id: formatUuid(attempt.id),
        started_at: toIsoOrNull(attempt.started_at),
        submitted_at: toIsoOrNull(attempt.submitted_at),
        duration_sec:
            attempt.duration_sec === null ||
            attempt.duration_sec === undefined
                ? null
                : Number(attempt.duration_sec),
        score:
            attempt.score === null ||
            attempt.score === undefined
                ? null
                : Number(attempt.score),
        total: Number(attempt.total || 0),
        quiz_id: formatUuid(attempt.quiz_id),
        user_id: attempt.user_id,
        wrong_reviewed_at:
            toIsoOrNull(attempt.wrong_reviewed_at),
    }));
};

export const getAttemptReview = async (
    userId,
    attemptId,
    wrongOnly
) => {
    const attempt = await getUserAttemptOrThrow(
        attemptId,
        userId
    );

    if (!attempt.submitted_at) {
        throw new HttpError(
            400,
            "Attempt not submitted yet."
        );
    }

    let answers = await findAttemptAnswers(
        attemptId
    );

    if (wrongOnly) {
        answers = answers.filter(
            (answer) =>
                !Boolean(answer.is_correct)
        );
    }

    return {
        attempt_id: formatUuid(attemptId),
        questions: answers.map((answer) => ({
            stem: answer.stem,
            options: [
                answer.option_a,
                answer.option_b,
                answer.option_c,
                answer.option_d,
            ],
            user_choice: answer.choice_index,
            correct_choice: answer.correct_index,
            correct: Boolean(
                answer.is_correct
            ),
            explanation:
                answer.explanation ||
                "No explanation provided.",
            sources: hydrateSources(
                parseJson(answer.sources, []),
                attempt.quiz_sources
            ),
        })),
    };
};

export const markWrongReviewComplete = async (
    userId,
    attemptId
) => {
    const attempt = await getUserAttemptOrThrow(
        attemptId,
        userId
    );

    const reviewedAt = new Date();

    await markWrongReviewCompleteModel(
        attempt.id,
        reviewedAt
    );

    return {
        success: true,
        wrong_reviewed_at:
            reviewedAt.toISOString(),
    };
};

export const generateAiQuiz = async (
    userId,
    {
        subjectId,
        prompt,
        title = "",
        count = 10,
        duration = 600,
        difficulty = "medium",
    }
) => {
    const usage = await checkUsageLimit(userId, "quizzes");
    if (!usage.allowed) {
        throw new HttpError(429, usage.message);
    }

    const subject = await findSubjectById(subjectId);
    if (!subject) {
        throw new HttpError(404, "Subject not found.");
    }

    const enrolled = await isUserEnrolledInSubject(userId, subjectId);
    if (!enrolled) {
        throw new HttpError(403, "Not enrolled in subject.");
    }

    const generated = await generateQuizWithAi({
        subjectName: subject.name,
        subjectCode: subject.code,
        prompt,
        count,
        title,
        difficulty,
        userId,
    });
    const quizId = crypto.randomUUID().replace(/-/g, "");
    const createdAt = new Date();
    const allowedChunkIds = new Set(
        generated.sources.map((source) => Number(source.chunk_id))
    );
    const questionSources = generated.questions.map((question) => {
        const rawSources = Array.isArray(question.sources)
            ? question.sources
            : [];
        const filtered = rawSources.filter(
            (source) => allowedChunkIds.has(Number(source))
        );
        return filtered.length > 0 || rawSources.length === 0
            ? filtered
            : rawSources;
    });
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        await createQuiz({
            id: quizId,
            userId,
            subjectId,
            title: generated.title,
            prompt,
            questionCount: generated.questions.length,
            durationSec: duration,
            difficulty,
            sources: generated.sources,
            createdAt,
        }, connection);

        for (const [index, question] of generated.questions.entries()) {
            await createQuizQuestion({
                quizId,
                stem: question.stem,
                options: question.options,
                correctIndex: question.answer_index,
                explanation: question.explanation,
                sources: questionSources[index],
            }, connection);
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    await incrementUsage(userId, "quizzes");

    return {
        quiz_id: formatUuid(quizId),
        sources: generated.sources,
        question_sources: questionSources,
    };
};
