import express from "express";
import {
    getSubscriptionStatusController,
    revenueCatWebhookController,
    syncSubscriptionController,
} from "../controllers/subscriptionController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
    "/subscription/status/",
    authenticate,
    getSubscriptionStatusController
);
router.post(
    "/subscription/sync/",
    authenticate,
    syncSubscriptionController
);
router.post(
    "/webhooks/revenuecat/",
    revenueCatWebhookController
);

export default router;
