import express from "express";
import {
    analyticsSummaryController,
    analyticsTopUsersController,
} from "../controllers/analyticsController.js";
import {
    banManagedUserController,
    deleteManagedUserController,
    deleteManagedUsersController,
    getManagedUserController,
    listManagedUsersController,
    unbanManagedUserController,
    updateManagedUserController,
} from "../controllers/adminUserController.js";
import { authorizeAnalytics } from "../middleware/analyticsAuthMiddleware.js";
import {
    broadcastNotification,
    getNotificationStatus,
} from "../services/notificationService.js";
import { successResponse } from "../utils/apiResponse.js";
import { body } from "express-validator";
import { validate } from "../middleware/validate.js";
import {
    analyticsSummaryValidation,
    analyticsTopUsersValidation,
} from "../validations/analyticsValidation.js";
import {
    managedUserIdValidation,
    updateManagedUserValidation,
} from "../validations/adminUserValidation.js";

const router = express.Router();

router.get(
    "/analytics/summary/",
    authorizeAnalytics,
    analyticsSummaryValidation,
    validate,
    analyticsSummaryController
);
router.get(
    "/analytics/top-users/",
    authorizeAnalytics,
    analyticsTopUsersValidation,
    validate,
    analyticsTopUsersController
);
router.get(
    "/analytics/users/",
    authorizeAnalytics,
    listManagedUsersController
);
router.delete(
    "/analytics/users/",
    authorizeAnalytics,
    deleteManagedUsersController
);
router.get(
    "/analytics/users/:userId/",
    authorizeAnalytics,
    managedUserIdValidation,
    validate,
    getManagedUserController
);
router.patch(
    "/analytics/users/:userId/",
    authorizeAnalytics,
    updateManagedUserValidation,
    validate,
    updateManagedUserController
);
router.post(
    "/analytics/users/:userId/ban/",
    authorizeAnalytics,
    managedUserIdValidation,
    validate,
    banManagedUserController
);
router.post(
    "/analytics/users/:userId/unban/",
    authorizeAnalytics,
    managedUserIdValidation,
    validate,
    unbanManagedUserController
);
router.delete(
    "/analytics/users/:userId/",
    authorizeAnalytics,
    deleteManagedUserController
);

router.get(
    "/analytics/notifications/status/",
    authorizeAnalytics,
    async (req, res, next) => {
        try {
            return successResponse(res, 200, "Notification status.", await getNotificationStatus());
        } catch (error) {
            return next(error);
        }
    }
);

// Push notification broadcast from the admin dashboard.
router.post(
    "/analytics/notifications/broadcast/",
    authorizeAnalytics,
    body("title").isString().trim().notEmpty().isLength({ max: 120 }),
    body("body").isString().trim().notEmpty().isLength({ max: 500 }),
    body("tier").optional({ nullable: true, values: "falsy" }).isIn(["free", "plus", "pro"]),
    validate,
    async (req, res, next) => {
        try {
            // Dashboard access may come through IAP (no req.user); it is
            // already authorised by authorizeAnalytics.
            const actor = req.user || { role: "admin" };
            const data = await broadcastNotification(actor, {
                title: req.body.title,
                body: req.body.body,
                tier: req.body.tier || null,
            });
            return successResponse(res, 200, "Notification broadcast completed.", data);
        } catch (error) {
            return next(error);
        }
    }
);

export default router;
