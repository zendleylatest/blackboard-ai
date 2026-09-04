import express from "express";
import {
    broadcastNotificationController,
    registerDeviceTokenController,
    unregisterDeviceTokenController,
} from "../controllers/notificationController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
    broadcastNotificationValidation,
    registerDeviceTokenValidation,
    unregisterDeviceTokenValidation,
} from "../validations/notificationValidation.js";

const router = express.Router();

router.post(
    "/device-token/register/",
    authenticate,
    registerDeviceTokenValidation,
    validate,
    registerDeviceTokenController
);
router.post(
    "/device-token/unregister/",
    authenticate,
    unregisterDeviceTokenValidation,
    validate,
    unregisterDeviceTokenController
);
router.post(
    "/notifications/broadcast/",
    authenticate,
    broadcastNotificationValidation,
    validate,
    broadcastNotificationController
);

export default router;
