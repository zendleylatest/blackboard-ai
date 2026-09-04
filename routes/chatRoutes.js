import express from "express";
import multer from "multer";
import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
    sendChatMessageController,
    listChatAttachmentsController,
    uploadChatAttachmentController,
    downloadChatAttachmentController,
    submitMcqWrongReviewController,
} from "../controllers/chatController.js";
import {
    chatThreadIdValidation,
    sendChatMessageValidation,
    attachmentIdValidation,
    mcqWrongReviewValidation,
} from "../validations/chatValidation.js";

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
});

router.post(
    "/threads/:thread_id/messages/send/",
    authenticate,
    sendChatMessageValidation,
    validate,
    sendChatMessageController
);

router.post(
    "/threads/:thread_id/mcq/review/",
    authenticate,
    mcqWrongReviewValidation,
    validate,
    submitMcqWrongReviewController
);

router.get(
    "/threads/:thread_id/attachments/",
    authenticate,
    chatThreadIdValidation,
    validate,
    listChatAttachmentsController
);

router.post(
    "/threads/:thread_id/attachments/upload/",
    authenticate,
    chatThreadIdValidation,
    validate,
    upload.single("file"),
    uploadChatAttachmentController
);

router.get(
    "/threads/:thread_id/attachments/:att_id/download/",
    authenticate,
    attachmentIdValidation,
    validate,
    downloadChatAttachmentController
);

export default router;
