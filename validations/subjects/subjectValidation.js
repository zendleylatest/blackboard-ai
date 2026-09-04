import { param, query } from "express-validator";

export const subjectListValidation = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("page must be a positive integer"),

    // Accepted for current mobile clients but intentionally capped to the
    // legacy backend's fixed 20-item page size.
    query("page_size")
        .optional()
        .isInt({ min: 1 })
        .withMessage("page_size must be a positive integer"),

    query("level")
        .optional()
        .isIn(["O", "A"])
        .withMessage('level must be either "O" or "A"'),

    query("exam_board")
        .optional()
        .isIn([
            "cambridge",
            "edexcel",
            "aqa",
            "ocr",
            "wjec",
        ])
        .withMessage(
            "exam_board must be a valid exam board"
        ),
];

export const subjectIdValidation = [
    param("subject_id")
        .isInt({ min: 1 })
        .withMessage("subject_id must be a valid subject ID"),
];
