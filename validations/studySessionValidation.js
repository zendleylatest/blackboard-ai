import { body, param, query } from "express-validator";

const sessionId = param("session_id")
    .isUUID()
    .withMessage("session_id must be a valid UUID.");
const questionId = param("question_id")
    .isUUID()
    .withMessage("question_id must be a valid UUID.");

export const listStudySessionsValidation = [
    query("subject_id").optional().isInt({ min: 1 }),
    query("status").optional().isIn(["in_progress", "completed"]),
];

export const createStudySessionValidation = [
    body("question_paper_id").isInt({ min: 1 }),
    body("mark_scheme_id").isInt({ min: 1 }),
    body("subject_id").optional({ nullable: true }).isInt({ min: 1 }),
];

export const studySessionIdValidation = [sessionId];
export const sessionQuestionIdValidation = [sessionId, questionId];

export const submitAnswerValidation = [
    ...sessionQuestionIdValidation,
    body("answer_text").optional({ nullable: true }).isString(),
    body("attachments").optional().isArray(),
];

export const followupValidation = [
    ...sessionQuestionIdValidation,
    body("message").isString().trim().notEmpty(),
];

