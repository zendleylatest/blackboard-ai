import { query } from "express-validator";

const dateQuery = (name) => (
    query(name)
        .optional()
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage(`${name} must use YYYY-MM-DD format.`)
);

export const analyticsSummaryValidation = [
    dateQuery("start_date"),
    dateQuery("end_date"),
    query("subject_id").optional().isInt({ min: 1 }),
];

export const analyticsTopUsersValidation = [
    dateQuery("start_date"),
    dateQuery("end_date"),
    query("page").optional().isInt({ min: 1 }),
    query("page_size").optional().isInt({ min: 1, max: 100 }),
];
