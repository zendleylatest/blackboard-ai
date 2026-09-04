import { body, param } from "express-validator";

export const checkerThreadValidation = [
    param("thread_id").isUUID().withMessage("thread_id must be a valid UUID."),
];

export const checkerEvaluationValidation = [
    param("evaluation_id").isUUID().withMessage("evaluation_id must be a valid UUID."),
];

export const questionMappingsValidation = [
    param("document_id").isInt({ min: 1 }).withMessage("document_id must be a positive integer."),
];

export const submitCheckerValidation = [
    ...checkerThreadValidation,
    body("mode")
        .optional()
        .isIn(["general", "past_paper"])
        .withMessage("mode must be general or past_paper."),
    body("student_answer")
        .optional({ nullable: true })
        .isString()
        .withMessage("student_answer must be a string."),
    body("question")
        .optional({ nullable: true })
        .isString()
        .withMessage("question must be a string."),
    body("question_paper_id")
        .optional({ nullable: true })
        .isInt({ min: 1 })
        .withMessage("question_paper_id must be a positive integer."),
    body("question_number")
        .optional({ nullable: true })
        .isString()
        .withMessage("question_number must be a string."),
    body("question_part")
        .optional({ nullable: true })
        .isString()
        .withMessage("question_part must be a string."),
    body("question_subpart")
        .optional({ nullable: true })
        .isString()
        .withMessage("question_subpart must be a string."),
    body("attachment_ids")
        .optional()
        .isArray()
        .withMessage("attachment_ids must be an array."),
];

