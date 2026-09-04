import {
    query,
    param,
    body,
} from "express-validator";

export const listChatThreadsValidation = [
    query("subject_id")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "Subject ID must be a valid integer"
        ),
];

export const createChatThreadValidation = [
    body("subject_id")
        .optional({ nullable: true })
        .isInt({ min: 1 })
        .withMessage(
            "Subject ID must be a valid integer"
        ),

    body("title")
        .optional()
        .isString()
        .withMessage(
            "Title must be a string"
        )
        .isLength({ max: 120 })
        .withMessage(
            "Title must not exceed 120 characters"
        ),
];

export const threadIdValidation = [
    param("thread_id")
        .isUUID()
        .withMessage(
            "Thread ID must be a valid UUID"
        ),
];

export const generateChatTitleValidation = [
    param("thread_id")
        .isUUID()
        .withMessage(
            "Thread ID must be a valid UUID"
        ),

    body("first_message")
        .isString()
        .withMessage(
            "first_message must be a string"
        )
        .trim()
        .notEmpty()
        .withMessage(
            "first_message required"
        ),

    body("subject_code")
        .optional()
        .isString()
        .withMessage(
            "subject_code must be a string"
        ),
];
