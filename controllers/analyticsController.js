import {
    getAnalyticsSummary,
    getAnalyticsTopUsers,
} from "../services/analyticsService.js";

export const analyticsSummaryController = async (req, res, next) => {
    try {
        const data = await getAnalyticsSummary({
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            subjectId: req.query.subject_id,
        });
        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (error) {
        next(error);
    }
};

export const analyticsTopUsersController = async (req, res, next) => {
    try {
        const data = await getAnalyticsTopUsers({
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            page: req.query.page,
            pageSize: req.query.page_size,
        });
        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (error) {
        next(error);
    }
};
