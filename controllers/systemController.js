import { successResponse } from "../utils/apiResponse.js";
import {
    bootstrapAdmin,
    getDashboard,
    getStats,
    listMysqlSubjects,
} from "../services/systemService.js";

export const bootstrapAdminController = async (req, res, next) => {
    try {
        const data = await bootstrapAdmin({
            headerToken: req.get("X-Bootstrap-Token"),
            bodyToken: req.body.token,
            email: req.body.email,
            password: req.body.password,
            fullName: req.body.full_name,
            age: req.body.age,
            classLevel: req.body.class_level,
            examBoard: req.body.exam_board,
            isSuperuser: req.body.is_superuser,
        });
        return successResponse(res, 200, "Admin user updated.", data);
    } catch (error) {
        next(error);
    }
};

export const getUserStatsController = async (req, res, next) => {
    try {
        const data = await getStats(req.user.id);
        return successResponse(res, 200, "User statistics retrieved successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const getDashboardController = async (req, res, next) => {
    try {
        const data = await getDashboard(req.user.id);
        return successResponse(res, 200, "Dashboard data retrieved successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const listMysqlSubjectsController = async (req, res, next) => {
    try {
        const data = await listMysqlSubjects();
        return successResponse(res, 200, "Subjects retrieved successfully.", data);
    } catch (error) {
        next(error);
    }
};
