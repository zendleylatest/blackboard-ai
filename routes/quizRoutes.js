import express from "express";

import {
    listUserQuizzesController,
    getQuizDetailController,
    startQuizAttemptController,
    submitQuizAnswerController,
    submitQuizAttemptController,
    getQuizAttemptsController,
    getAttemptReviewController,
    markWrongReviewCompleteController,
    generateAiQuizController,
} from "../controllers/quizController.js";

import {
    listUserQuizzesValidation,
    getQuizDetailValidation,
    startQuizAttemptValidation,
    submitQuizAnswerValidation,
    submitQuizAttemptValidation,
    getQuizAttemptsValidation,
    getAttemptReviewValidation,
    markWrongReviewCompleteValidation,
    generateAiQuizValidation,
} from "../validations/quizValidation.js";

import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post(
    "/ai/quizzes/",
    authenticate,
    generateAiQuizValidation,
    validate,
    generateAiQuizController
);

router.get(
    "/subjects/:subjectId/quizzes",
    authenticate,
    listUserQuizzesValidation,
    validate,
    listUserQuizzesController
);

router.get(
    "/quizzes/:quizId",
    authenticate,
    getQuizDetailValidation,
    validate,
    getQuizDetailController
);

router.post(
    "/quizzes/:quizId/attempts/start",
    authenticate,
    startQuizAttemptValidation,
    validate,
    startQuizAttemptController
);

router.post(
    "/attempts/:attemptId/answer",
    authenticate,
    submitQuizAnswerValidation,
    validate,
    submitQuizAnswerController
);

// Compatibility for the existing Flutter client, which still sends PATCH.
// POST remains the canonical method for the Node API.
router.patch(
    "/attempts/:attemptId/answer",
    authenticate,
    submitQuizAnswerValidation,
    validate,
    submitQuizAnswerController
);

router.post(
    "/attempts/:attemptId/submit",
    authenticate,
    submitQuizAttemptValidation,
    validate,
    submitQuizAttemptController
);

router.get(
    "/quizzes/:quizId/attempts",
    authenticate,
    getQuizAttemptsValidation,
    validate,
    getQuizAttemptsController
);

router.get(
    "/attempts/:attemptId/review",
    authenticate,
    getAttemptReviewValidation,
    validate,
    getAttemptReviewController
);

router.post(
    "/attempts/:attemptId/review/complete",
    authenticate,
    markWrongReviewCompleteValidation,
    validate,
    markWrongReviewCompleteController
);

export default router;
