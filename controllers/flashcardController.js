import { successResponse } from "../utils/apiResponse.js";
import {
    listFlashcardSets,
    getFlashcardSet,
    createManualFlashcardSet,
    deleteFlashcardSetForUser,
    startStudySession,
    submitReviewEvent,
    completeStudy,
    getPerformanceHistory,
    getWrongCards,
    generateAiFlashcardSet,
} from "../services/flashcardService.js";

export const listFlashcardSetsController = async (req, res, next) => {
    try {
        const data = await listFlashcardSets(req.user.id, req.params.subjectId);
        return successResponse(res, 200, "Flashcard sets retrieved successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const getFlashcardSetController = async (req, res, next) => {
    try {
        const data = await getFlashcardSet(req.user.id, req.params.setId);
        return successResponse(res, 200, "Flashcard set retrieved successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const createManualFlashcardSetController = async (req, res, next) => {
    try {
        const data = await createManualFlashcardSet(req.user.id, {
            subjectId: req.body.subject_id,
            title: req.body.title,
            topic: req.body.topic,
            difficulty: req.body.difficulty || req.body.difficulty_level,
            cards: req.body.cards,
        });
        return successResponse(res, 201, "Flashcard set created successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const deleteFlashcardSetController = async (req, res, next) => {
    try {
        const data = await deleteFlashcardSetForUser(req.user.id, req.params.setId);
        return successResponse(res, 200, "Flashcard set deleted successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const startStudySessionController = async (req, res, next) => {
    try {
        const data = await startStudySession(req.user.id, req.params.setId);
        return successResponse(res, 201, "Study session started successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const submitReviewEventController = async (req, res, next) => {
    try {
        const data = await submitReviewEvent(req.user.id, req.params.setId, {
            sessionId: req.body.session_id,
            cardId: req.body.card_id,
            result: req.body.result,
        });
        return successResponse(res, 200, "Flashcard review saved successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const completeStudyController = async (req, res, next) => {
    try {
        const data = await completeStudy(req.user.id, req.params.setId, {
            sessionId: req.body.session_id,
            durationSec: req.body.duration_sec,
        });
        return successResponse(res, 200, "Study session completed successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const getPerformanceHistoryController = async (req, res, next) => {
    try {
        const data = await getPerformanceHistory(req.user.id, req.params.setId);
        return successResponse(res, 200, "Performance history retrieved successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const getWrongCardsController = async (req, res, next) => {
    try {
        const data = await getWrongCards(req.user.id, req.params.setId, req.params.sessionId);
        return successResponse(res, 200, "Wrong cards retrieved successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const generateAiFlashcardSetController = async (req, res, next) => {
    try {
        const data = await generateAiFlashcardSet(req.user.id, {
            subjectId: req.body.subject_id,
            topic: req.body.topic,
            prompt: req.body.prompt,
            count: req.body.count,
            difficulty: req.body.difficulty,
        });
        return successResponse(res, 201, "AI flashcard set generated successfully.", data);
    } catch (error) {
        next(error);
    }
};
