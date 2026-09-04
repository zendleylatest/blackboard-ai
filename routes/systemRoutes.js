import express from "express";
import {
    bootstrapAdminController,
    getDashboardController,
    getUserStatsController,
    listMysqlSubjectsController,
} from "../controllers/systemController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { bootstrapAdminValidation } from "../validations/systemValidation.js";

const router = express.Router();

router.post(
    "/admin/bootstrap/",
    bootstrapAdminValidation,
    validate,
    bootstrapAdminController
);
router.get("/auth/stats/", authenticate, getUserStatsController);
router.get("/dashboard/", authenticate, getDashboardController);
router.get("/mysql-subjects/", authenticate, listMysqlSubjectsController);

export default router;
