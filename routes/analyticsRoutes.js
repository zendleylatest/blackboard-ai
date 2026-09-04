import express from "express";
import {
    analyticsSummaryController,
    analyticsTopUsersController,
} from "../controllers/analyticsController.js";
import { authorizeAnalytics } from "../middleware/analyticsAuthMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
    analyticsSummaryValidation,
    analyticsTopUsersValidation,
} from "../validations/analyticsValidation.js";

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

export default router;
