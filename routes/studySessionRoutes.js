import express from "express";
import multer from "multer";
import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
    completeStudySessionController,
    createStudySessionController,
    deleteStudySessionController,
    getQuestionChatHistoryController,
    getSessionQuestionUsageController,
    getSessionQuestionController,
    getStudySessionController,
    listStudySessionsController,
    sendFollowupChatController,
    submitQuestionAnswerController,
    uploadStudySessionAttachmentController,
    getUsageLimitsController,
} from "../controllers/studySessionController.js";
import {
    createStudySessionValidation,
    followupValidation,
    listStudySessionsValidation,
    sessionQuestionIdValidation,
    studySessionIdValidation,
    submitAnswerValidation,
} from "../validations/studySessionValidation.js";

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
});

router.get("/study-sessions/", authenticate, listStudySessionsValidation, validate, listStudySessionsController);
router.post("/study-sessions/create/", authenticate, createStudySessionValidation, validate, createStudySessionController);
router.get("/study-sessions/:session_id/", authenticate, studySessionIdValidation, validate, getStudySessionController);
router.delete("/study-sessions/:session_id/delete/", authenticate, studySessionIdValidation, validate, deleteStudySessionController);
router.post("/study-sessions/:session_id/complete/", authenticate, studySessionIdValidation, validate, completeStudySessionController);
router.get("/study-sessions/:session_id/questions/:question_id/", authenticate, sessionQuestionIdValidation, validate, getSessionQuestionController);
router.post("/study-sessions/:session_id/questions/:question_id/answer/", authenticate, submitAnswerValidation, validate, submitQuestionAnswerController);
router.post("/study-sessions/:session_id/questions/:question_id/chat/", authenticate, followupValidation, validate, sendFollowupChatController);
router.post("/study-sessions/:session_id/questions/:question_id/chat/stream/", authenticate, followupValidation, validate, sendFollowupChatController);
router.get("/study-sessions/:session_id/questions/:question_id/chat/history/", authenticate, sessionQuestionIdValidation, validate, getQuestionChatHistoryController);
router.post("/study-sessions/:session_id/attachments/upload/", authenticate, studySessionIdValidation, validate, upload.single("file"), uploadStudySessionAttachmentController);
router.get("/usage-limits/", authenticate, getUsageLimitsController);
router.get("/study-sessions/:session_id/questions/:question_id/usage/", authenticate, sessionQuestionIdValidation, validate, getSessionQuestionUsageController);

export default router;
