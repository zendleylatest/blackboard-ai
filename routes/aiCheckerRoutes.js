import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
    getAiCheckerEvaluationController,
    getAiCheckerHistoryController,
    getQuestionMappingsController,
    submitAiCheckerEvaluationController,
    submitAiCheckerEvaluationStreamController,
} from "../controllers/aiCheckerController.js";
import {
    checkerEvaluationValidation,
    checkerThreadValidation,
    questionMappingsValidation,
    submitCheckerValidation,
} from "../validations/aiCheckerValidation.js";

const router = express.Router();

router.post(
    "/chat/threads/:thread_id/checker/evaluate/",
    authenticate,
    submitCheckerValidation,
    validate,
    submitAiCheckerEvaluationController
);
router.post(
    "/chat/threads/:thread_id/checker/evaluate/stream/",
    authenticate,
    submitCheckerValidation,
    validate,
    submitAiCheckerEvaluationStreamController
);
router.get(
    "/chat/threads/:thread_id/checker/history/",
    authenticate,
    checkerThreadValidation,
    validate,
    getAiCheckerHistoryController
);
router.get(
    "/documents/:document_id/questions/",
    authenticate,
    questionMappingsValidation,
    validate,
    getQuestionMappingsController
);
router.get(
    "/checker/evaluations/:evaluation_id/",
    authenticate,
    checkerEvaluationValidation,
    validate,
    getAiCheckerEvaluationController
);

export default router;

