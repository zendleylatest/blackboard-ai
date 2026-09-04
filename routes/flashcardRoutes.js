import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
    listFlashcardSetsController,
    getFlashcardSetController,
    createManualFlashcardSetController,
    deleteFlashcardSetController,
    startStudySessionController,
    submitReviewEventController,
    completeStudyController,
    getPerformanceHistoryController,
    getWrongCardsController,
    generateAiFlashcardSetController,
} from "../controllers/flashcardController.js";
import {
    listFlashcardSetsValidation,
    getFlashcardSetValidation,
    createManualFlashcardSetValidation,
    deleteFlashcardSetValidation,
    startStudySessionValidation,
    submitReviewEventValidation,
    completeStudyValidation,
    getPerformanceHistoryValidation,
    getWrongCardsValidation,
    generateAiFlashcardSetValidation,
} from "../validations/flashcardValidation.js";

const router = express.Router();

router.post("/ai/flashcards/", authenticate, generateAiFlashcardSetValidation, validate, generateAiFlashcardSetController);

router.get("/subjects/:subjectId/flashcards/sets/", authenticate, listFlashcardSetsValidation, validate, listFlashcardSetsController);
router.get("/subjects/:subjectId/flashcard-sets/", authenticate, listFlashcardSetsValidation, validate, listFlashcardSetsController);

router.post("/flashcard-sets/", authenticate, createManualFlashcardSetValidation, validate, createManualFlashcardSetController);

router.get("/flashcard-sets/:setId/", authenticate, getFlashcardSetValidation, validate, getFlashcardSetController);
router.get("/flashcards/sets/:setId/", authenticate, getFlashcardSetValidation, validate, getFlashcardSetController);

router.delete("/flashcard-sets/:setId/delete/", authenticate, deleteFlashcardSetValidation, validate, deleteFlashcardSetController);
router.delete("/flashcards/sets/:setId/delete/", authenticate, deleteFlashcardSetValidation, validate, deleteFlashcardSetController);

router.post("/flashcard-sets/:setId/study/start/", authenticate, startStudySessionValidation, validate, startStudySessionController);
router.post("/flashcards/sets/:setId/study/start/", authenticate, startStudySessionValidation, validate, startStudySessionController);
router.post("/flashcard-sets/:setId/study/review/", authenticate, submitReviewEventValidation, validate, submitReviewEventController);
router.post("/flashcards/sets/:setId/study/review/", authenticate, submitReviewEventValidation, validate, submitReviewEventController);
router.post("/flashcard-sets/:setId/study/complete/", authenticate, completeStudyValidation, validate, completeStudyController);
router.post("/flashcards/sets/:setId/study/complete/", authenticate, completeStudyValidation, validate, completeStudyController);

router.get("/flashcard-sets/:setId/performance-history/", authenticate, getPerformanceHistoryValidation, validate, getPerformanceHistoryController);
router.get("/flashcard-sets/:setId/sessions/:sessionId/wrong-cards/", authenticate, getWrongCardsValidation, validate, getWrongCardsController);

export default router;
