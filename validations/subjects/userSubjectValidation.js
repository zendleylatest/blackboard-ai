import { body, param } from "express-validator";

export const enrollSubjectValidation = [
    param("subjectId")
        .isInt({ min: 1 })
        .withMessage("Subject ID must be a valid integer."),
];

export const unenrollSubjectValidation = [
    param("subjectId")
        .isInt({ min: 1 })
        .withMessage("Subject ID must be a valid integer."),
];