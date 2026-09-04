import { body } from "express-validator";

export const ragRetrieveValidation = [
    body("query")
        .isString()
        .trim()
        .notEmpty()
        .withMessage("Query is required."),
    body("subject_code")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 30 }),
    body("modes")
        .optional()
        .isArray()
        .withMessage("modes must be an array."),
    body("filters")
        .optional()
        .isObject()
        .withMessage("filters must be an object."),
    body("k_text").optional().isInt({ min: 1, max: 50 }),
    body("k_clip_text").optional().isInt({ min: 0, max: 50 }),
    body("k_image").optional().isInt({ min: 0, max: 50 }),
    body("max_context_tokens").optional().isInt({ min: 100, max: 10000 }),
    body("qref_hint").optional({ nullable: true }).isString().isLength({ max: 64 }),
    body("recency_boost").optional().isBoolean(),
    body("recency_years").optional().isInt({ min: 1, max: 50 }),
    body("recent_first").optional().isBoolean(),
    body("heuristic_rerank").optional().isBoolean(),
    body("use_cache").optional().isBoolean(),
];
