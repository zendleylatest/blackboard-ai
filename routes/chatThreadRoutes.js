import express from "express";

import {
    listChatThreadsController,
    createChatThreadController,
    deleteChatThreadController,
    generateChatTitleController,
    getThreadMessagesController,
} from "../controllers/chatThreadController.js";

import {
    listChatThreadsValidation,
    createChatThreadValidation,
    threadIdValidation,
    generateChatTitleValidation,
} from "../validations/chatThreadValidation.js";

import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
    "/",
    authenticate,
    listChatThreadsValidation,
    validate,
    listChatThreadsController
);

router.post(
    "/",
    authenticate,
    createChatThreadValidation,
    validate,
    createChatThreadController
);

router.post(
    "/create/",
    authenticate,
    createChatThreadValidation,
    validate,
    createChatThreadController
);

router.delete(
    "/:thread_id",
    authenticate,
    threadIdValidation,
    validate,
    deleteChatThreadController
);

router.post(
    "/:thread_id/generate-title",
    authenticate,
    generateChatTitleValidation,
    validate,
    generateChatTitleController
);

router.get(
    "/:thread_id/messages",
    authenticate,
    threadIdValidation,
    validate,
    getThreadMessagesController
);

export default router;
