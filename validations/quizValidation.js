import { body, param, query } from "express-validator";

export const generateAiQuizValidation = [
    body("subject_id")
        .isInt({ min: 1 })
        .withMessage("subject_id must be a positive integer."),
    body("prompt")
        .isString()
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage("prompt must contain between 1 and 500 characters."),
    body("title")
        .optional({ nullable: true })
        .isString()
        .isLength({ max: 50 }),
    body("count")
        .optional()
        .isIn([10, 20])
        .withMessage("count must be 10 or 20."),
    body("duration")
        .optional()
        .isIn([600, 1200])
        .withMessage("duration must be 600 or 1200."),
    body("difficulty")
        .optional()
        .isIn(["easy", "medium", "hard"]),
];

export const listUserQuizzesValidation = [
    param("subjectId")
        .isInt({ min: 1 })
        .withMessage("Subject ID must be a positive integer."),
];

export const getQuizDetailValidation = [
    param("quizId")
        .isUUID()
        .withMessage("Quiz ID must be a valid UUID."),
];

export const startQuizAttemptValidation = [
    param("quizId")
        .isUUID()
        .withMessage("Quiz ID must be a valid UUID."),
];

export const submitQuizAnswerValidation = [
    param("attemptId")
        .isUUID()
        .withMessage("Attempt ID must be a valid UUID."),

    body("question_id")
        .isInt({ min: 1 })
        .withMessage("Question ID must be a positive integer."),

    body("choice_index")
        .optional({ nullable: true })
        .isInt({ min: 0, max: 3 })
        .withMessage("Choice index must be between 0 and 3."),
];

export const submitQuizAttemptValidation = [
    param("attemptId")
        .isUUID()
        .withMessage("Attempt ID must be a valid UUID."),
];

export const getQuizAttemptsValidation = [
    param("quizId")
        .isUUID()
        .withMessage("Quiz ID must be a valid UUID."),
];

export const getAttemptReviewValidation = [
    param("attemptId")
        .isUUID()
        .withMessage("Attempt ID must be a valid UUID."),

    query("wrong_only")
        .optional()
        .isBoolean()
        .withMessage("wrong_only must be true or false."),
];

export const markWrongReviewCompleteValidation = [
    param("attemptId")
        .isUUID()
        .withMessage("Attempt ID must be a valid UUID."),
];
