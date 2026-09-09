import crypto from "crypto";
import pool from "../config/database.js";
import HttpError from "../utils/httpError.js";
import { generateFlashcardsWithAi } from "./flashcard/flashcardAiService.js";
import {
    checkUsageLimit,
    incrementUsage,
} from "./usageLimitService.js";
import {
    findActiveSubjectById,
    findSubjectById,
    isUserEnrolledInSubject,
    findFlashcardSetsBySubject,
    findFlashcardSetForUser,
    findFlashcardsBySet,
    createFlashcardSet,
    createFlashcard,
    updateSetCardCount,
    deleteFlashcardSet,
    deleteFlashcardSetRelations,
    createStudySession,
    findStudySessionForUser,
    createReviewEvent,
    findReviewEventForCard,
    findFlashcardInSet,
    updateReviewedCard,
    findAverageLeitnerBox,
    updateSetAfterReview,
    updateSetLastStudied,
    findCompletedSessions,
    findWrongEvents,
    findReviewEventsBySession,
    completeStudySession,
    updateSetAfterCompletion,
    findSetLatestCompletedSession,
} from "../models/Flashcard.js";

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const parseJson = (value, fallback = []) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const iso = (value) => (
    value ? new Date(value).toISOString() : null
);

const normalizeSetId = (setId) => (
    String(setId || "").replace(/-/g, "").toLowerCase()
);

const formatUuid = (value) => {
    const raw = normalizeSetId(value);
    return raw.length === 32
        ? `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
        : String(value);
};

const serializeSubject = (row) => (
    row?.subject_id
        ? {
              id: row.subject_id,
              name: row.subject_name,
              code: row.subject_code,
              level: row.subject_level,
              exam_board: row.subject_exam_board,
              description: row.subject_description,
              is_active: Boolean(row.subject_is_active),
          }
        : null
);

const serializeCard = (
    card,
    setSources = [],
    subject = null
) => {
    const cardSourceIds = parseJson(card.sources, []);
    const sourceMap = new Map(
        parseJson(setSources, [])
            .filter((source) => source && typeof source === "object")
            .map((source) => [Number(source.chunk_id), source])
    );
    const sources = Array.isArray(cardSourceIds)
        ? cardSourceIds
              .map((source) => (
                  typeof source === "object"
                      ? source
                      : sourceMap.get(Number(source))
              ))
              .filter(Boolean)
        : [];

    return {
        id: card.id,
        subject: subject || (
            card.subject_id
                ? { id: card.subject_id }
                : null
        ),
        set: card.set_id ? formatUuid(card.set_id) : null,
        front_text: card.front_text,
        back_text: card.back_text,
        difficulty_level: card.difficulty_level,
        difficulty: card.difficulty || card.difficulty_level,
        leitner_box: Number(card.leitner_box || 1),
        times_reviewed: Number(card.times_reviewed || 0),
        last_reviewed_at: iso(card.last_reviewed_at),
        created_at: iso(card.created_at),
        sources,
    };
};

const serializeListSet = (set) => ({
    id: formatUuid(set.id),
    title: set.title,
    topic: set.topic,
    difficulty_level: set.difficulty_level,
    difficulty: set.difficulty_level,
    is_ai_generated: Boolean(set.is_ai_generated),
    card_count: Number(set.card_count || 0),
    reviews_today: Number(set.reviews_today || 0),
    reviews_total: Number(set.reviews_total || 0),
    completed_today: Boolean(set.completed_today),
    completed_total: Number(set.completed_total || 0),
    last_completed_at: iso(set.last_completed_at),
    last_studied: iso(set.last_studied),
    mastery: Number(set.mastery || 0),
    last_score: set.last_score === null || set.last_score === undefined
        ? null
        : Number(set.last_score),
    streak_count: Number(set.streak_count || 0),
    created_at: iso(set.created_at),
    updated_at: iso(set.updated_at),
});

const serializeSet = (set, cards, lastScore = null) => ({
    ...serializeListSet(set),
    description: set.description,
    subject: serializeSubject(set),
    last_score: lastScore,
    sources: parseJson(set.sources, []),
    cards: cards.map((card) => (
        serializeCard(card, set.sources, serializeSubject(set))
    )),
});

const getSetOrThrow = async (setId, userId, connection = null) => {
    const set = await findFlashcardSetForUser(
        normalizeSetId(setId),
        userId,
        connection
    );
    if (!set) throw new HttpError(404, "Set not found.");
    return set;
};

const requireEnrollment = async (userId, subjectId, connection = null) => {
    const enrolled = await isUserEnrolledInSubject(
        userId,
        subjectId,
        connection
    );
    if (!enrolled) {
        throw new HttpError(403, "Not enrolled in subject.");
    }
};

const getSetMastery = async (setId, connection = null) => {
    const averageBox = await findAverageLeitnerBox(setId, connection);
    return Math.min(1, Math.max(0, (averageBox - 1) / 4));
};

export const listFlashcardSets = async (userId, subjectId) => {
    const subject = await findActiveSubjectById(subjectId);
    if (!subject) throw new HttpError(404, "Subject not found.");
    await requireEnrollment(userId, subjectId);
    const sets = await findFlashcardSetsBySubject(userId, subjectId);
    return sets.map(serializeListSet);
};

export const getFlashcardSet = async (userId, setId) => {
    const set = await getSetOrThrow(setId, userId);
    const cards = await findFlashcardsBySet(set.id);
    const latest = await findSetLatestCompletedSession(set.id);
    const lastScore = latest && Number(latest.total_cards) > 0
        ? Number(latest.easy_count || 0) / Number(latest.total_cards)
        : null;
    return serializeSet(set, cards, lastScore);
};

export const createManualFlashcardSet = async (
    userId,
    {
        subjectId,
        title,
        topic,
        difficulty,
        cards = [],
        isAiGenerated = false,
        description = "",
        sources = [],
    }
) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const subject = await findActiveSubjectById(subjectId, connection);
        if (!subject) throw new HttpError(404, "Subject not found.");
        await requireEnrollment(userId, subjectId, connection);

        const setId = crypto.randomUUID().replace(/-/g, "");
        const setDifficulty = VALID_DIFFICULTIES.has(String(difficulty).toLowerCase())
            ? String(difficulty).toLowerCase()
            : "medium";
        const cleanTopic = String(topic || "").trim();
        const cleanTitle = String(title || cleanTopic || "Untitled Set")
            .trim()
            .slice(0, 50);

        const createdAt = new Date();
        await createFlashcardSet({
            id: setId,
            userId,
            subjectId,
            title: cleanTitle,
            topic: cleanTopic.slice(0, 200),
            difficultyLevel: setDifficulty,
            isAiGenerated,
            description,
            sources,
            createdAt,
        }, connection);

        let created = 0;
        for (const card of Array.isArray(cards) ? cards : []) {
            const front = String(card?.front ?? card?.front_text ?? "").trim().slice(0, 300);
            const back = String(card?.back ?? card?.back_text ?? "").trim().slice(0, 300);
            if (!front || !back) continue;
            const cardDifficulty = VALID_DIFFICULTIES.has(String(card?.difficulty || setDifficulty).toLowerCase())
                ? String(card?.difficulty || setDifficulty).toLowerCase()
                : setDifficulty;
            await createFlashcard({
                subjectId,
                setId,
                frontText: front,
                backText: back,
                difficultyLevel: cardDifficulty,
                sources: Array.isArray(card?.sources) ? card.sources : [],
                createdAt,
            }, connection);
            created += 1;
        }
        await updateSetCardCount(setId, created, connection);
        await connection.commit();
        return { set_id: formatUuid(setId), card_count: created };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export const deleteFlashcardSetForUser = async (userId, setId) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const set = await getSetOrThrow(setId, userId, connection);
        await deleteFlashcardSetRelations(set.id, connection);
        await deleteFlashcardSet(set.id, userId, connection);
        await connection.commit();
        return {};
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export const startStudySession = async (userId, setId) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const set = await getSetOrThrow(setId, userId, connection);
        const cards = await findFlashcardsBySet(set.id, connection);
        if (cards.length === 0) throw new HttpError(400, "No flashcards in set.");
        const now = new Date();
        const sessionId = await createStudySession({
            userId,
            setId: set.id,
            totalCards: cards.length,
            startedAt: now,
        }, connection);
        await updateSetLastStudied(set.id, now, connection);
        await connection.commit();
        return {
            session_id: sessionId,
            total_cards: cards.length,
            started_at: now.toISOString(),
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export const submitReviewEvent = async (
    userId,
    setId,
    { sessionId, cardId, result }
) => {
    const normalizedResult = String(result || "").toLowerCase();
    if (!["easy", "hard"].includes(normalizedResult)) {
        throw new HttpError(400, "Result must be easy or hard.");
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const set = await getSetOrThrow(setId, userId, connection);
        const session = await findStudySessionForUser(sessionId, set.id, userId, connection);
        if (!session) throw new HttpError(404, "Session not found.");
        if (session.completed_at) throw new HttpError(400, "Study session is already complete.");
        const card = await findFlashcardInSet(cardId, set.id, connection);
        if (!card) throw new HttpError(400, "Card does not belong to this set.");
        const existingEvent = await findReviewEventForCard(
            session.id,
            card.id,
            connection
        );
        if (existingEvent) {
            await connection.commit();
            return {};
        }
        const now = new Date();
        await updateReviewedCard(card.id, normalizedResult, now, connection);
        await createReviewEvent({ sessionId, cardId: card.id, result: normalizedResult, reviewedAt: now }, connection);
        const mastery = await getSetMastery(set.id, connection);
        await updateSetAfterReview({ setId: set.id, mastery }, connection);
        await connection.commit();
        return {};
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const dateKey = (value) => {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return value.slice(0, 10);
    }
    const date = new Date(value);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
};

export const completeStudy = async (
    userId,
    setId,
    { sessionId, durationSec = 0 }
) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const set = await getSetOrThrow(setId, userId, connection);
        const session = await findStudySessionForUser(sessionId, set.id, userId, connection);
        if (!session) throw new HttpError(400, "Session not found.");
        if (session.completed_at) {
            // Idempotent: a duplicate completion call (e.g. a race between a
            // manual answer tap and a deferred tilt-gesture callback on the
            // last card) is not an error from the client's perspective —
            // return the current state instead of failing the second call.
            await connection.commit();
            const mastery = await getSetMastery(set.id, connection);
            return {
                completed_total: Number(set.completed_total || 0),
                mastery,
                easy_count: session.easy_count || 0,
                hard_count: session.hard_count || 0,
                streak_count: Number(set.streak_count || 0),
            };
        }
        const events = await findReviewEventsBySession(sessionId, connection);
        const easyCount = events.filter((event) => event.result === "easy").length;
        const hardCount = events.filter((event) => event.result === "hard").length;
        const completedAt = new Date();
        const safeDuration = Math.max(0, Number(durationSec) || 0);
        await completeStudySession({ sessionId, completedAt, durationSec: safeDuration, easyCount, hardCount }, connection);
        const mastery = await getSetMastery(set.id, connection);
        const today = dateKey(completedAt);
        const previous = set.last_streak_date ? dateKey(set.last_streak_date) : null;
        const yesterdayDate = new Date(completedAt);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = dateKey(yesterdayDate);
        const streakCount = previous === today
            ? Number(set.streak_count || 0)
            : previous === yesterday
                ? Number(set.streak_count || 0) + 1
                : 1;
        await updateSetAfterCompletion({
            setId: set.id,
            completedAt,
            mastery,
            completedToday: true,
            streakCount,
            streakDate: completedAt,
        }, connection);
        await connection.commit();
        return {
            completed_total: Number(set.completed_total || 0) + 1,
            mastery,
            easy_count: easyCount,
            hard_count: hardCount,
            streak_count: streakCount,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export const getPerformanceHistory = async (userId, setId) => {
    const set = await getSetOrThrow(setId, userId);
    const sessions = await findCompletedSessions(set.id, userId);
    return sessions.map((session) => ({
        session_id: session.id,
        completed_at: iso(session.completed_at),
        total_cards: Number(session.total_cards || 0),
        easy_count: Number(session.easy_count || 0),
        hard_count: Number(session.hard_count || 0),
        score: Number(session.total_cards) > 0
            ? Math.round((Number(session.easy_count || 0) / Number(session.total_cards)) * 100)
            : 0,
        total_time: Number(session.duration_sec || 0),
        wrong_cards_count: Math.max(0, Number(session.hard_count || 0)),
    }));
};

export const getWrongCards = async (userId, setId, sessionId) => {
    const set = await getSetOrThrow(setId, userId);
    const session = await findStudySessionForUser(sessionId, set.id, userId);
    if (!session) throw new HttpError(404, "Session not found.");
    const cards = await findWrongEvents(sessionId);
    const subject = serializeSubject(set);
    return cards.map((card) => serializeCard(card, set.sources, subject));
};

export const generateAiFlashcardSet = async (
    userId,
    { subjectId, topic, prompt, count = 10, difficulty = "medium" }
) => {
    const usage = await checkUsageLimit(userId, "flashcard_sets");
    if (!usage.allowed) {
        throw new HttpError(429, usage.message);
    }
    const subject = await findSubjectById(subjectId);
    if (!subject) throw new HttpError(404, "Subject not found.");
    await requireEnrollment(userId, subjectId);
    const safeCount = Math.min(30, Math.max(1, Number(count) || 10));
    const safeDifficulty = VALID_DIFFICULTIES.has(String(difficulty).toLowerCase())
        ? String(difficulty).toLowerCase()
        : "medium";
    const generated = await generateFlashcardsWithAi({
        subjectName: subject.name,
        subjectCode: subject.code,
        topic: String(topic || "").trim(),
        prompt: String(prompt || "").trim(),
        count: safeCount,
        difficulty: safeDifficulty,
    });
    const allowedSourceIds = new Set(
        generated.sources.map((source) => Number(source.chunk_id))
    );
    const cards = generated.flashcards.map((card) => {
        const rawSources = Array.isArray(card.sources) ? card.sources : [];
        const filteredSources = rawSources.filter((source) => (
            allowedSourceIds.has(Number(source))
        ));
        return {
            ...card,
            sources: filteredSources.length > 0 || rawSources.length === 0
                ? filteredSources
                : rawSources,
        };
    });
    const result = await createManualFlashcardSet(userId, {
        subjectId,
        title: generated.title,
        topic,
        difficulty: safeDifficulty,
        cards,
        isAiGenerated: true,
        description: "AI generated flashcards",
        sources: generated.sources,
    });
    await incrementUsage(userId, "flashcard_sets");
    return { ...result, sources: generated.sources };
};
