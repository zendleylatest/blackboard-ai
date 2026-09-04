import { body, param } from "express-validator";

export const chatThreadIdValidation = [
    param("thread_id")
        .isUUID()
        .withMessage("thread_id must be a valid UUID."),
];

export const attachmentIdValidation = [
    ...chatThreadIdValidation,
    param("att_id")
        .isUUID()
        .withMessage("att_id must be a valid UUID."),
];

export const sendChatMessageValidation = [
    ...chatThreadIdValidation,
    body("text")
        .isString()
        .trim()
        .notEmpty()
        .withMessage("text required."),
    body("mode")
        .optional()
        .isString()
        .isLength({ max: 16 })
        .withMessage("mode must be a short string."),
    body("attachment_ids")
        .optional()
        .isArray()
        .withMessage("attachment_ids must be an array."),
    body("override_gating")
        .optional()
        .isBoolean()
        .withMessage("override_gating must be boolean."),
    body("paper_document_id")
        .optional({ nullable: true })
        .isInt({ min: 1 })
        .withMessage("paper_document_id must be a positive integer."),
];

export const mcqWrongReviewValidation = [
    ...chatThreadIdValidation,
    body("question_paper_id")
        .isInt({ min: 1 })
        .withMessage("question_paper_id must be a positive integer."),
    body("wrong_answers")
        .isArray({ min: 1 })
        .withMessage("wrong_answers must be a non-empty array."),
    body("wrong_answers.*.question_number")
        .isInt({ min: 1 })
        .withMessage("question_number must be a positive integer."),
    body("wrong_answers.*.selected_option")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 20 }),
];
