import express from "express";
import {
    analyticsSummaryController,
    analyticsTopUsersController,
} from "../controllers/analyticsController.js";
import {
    deleteManagedUserController,
    deleteManagedUsersController,
    getManagedUserController,
    listManagedUsersController,
    updateManagedUserController,
} from "../controllers/adminUserController.js";
import { authorizeAnalytics } from "../middleware/analyticsAuthMiddleware.js";
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
router.delete(
    "/analytics/users/:userId/",
    authorizeAnalytics,
    deleteManagedUserController
);

export default router;
