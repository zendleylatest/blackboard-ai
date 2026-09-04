import { body, param } from "express-validator";

const idParam = (name) => param(name).isInt({ min: 1 }).withMessage(`${name} must be a positive integer.`);
const setParam = () => (
    param("setId").isUUID().withMessage("setId must be a valid UUID.")
);

export const listFlashcardSetsValidation = [idParam("subjectId")];
export const getFlashcardSetValidation = [setParam()];
export const deleteFlashcardSetValidation = [setParam()];
export const startStudySessionValidation = [setParam()];
export const getPerformanceHistoryValidation = [setParam()];
export const getWrongCardsValidation = [
    setParam(),
    idParam("sessionId"),
];

export const createManualFlashcardSetValidation = [
    body("subject_id").isInt({ min: 1 }).withMessage("subject_id must be a positive integer."),
    body("topic").optional({ nullable: true }).isString().isLength({ max: 200 }),
    body("title").optional({ nullable: true }).isString().isLength({ max: 200 }),
    body("difficulty").optional().isIn(["easy", "medium", "hard"]),
    body("cards").isArray().withMessage("cards must be an array."),
    body("cards.*.front").optional().isString().isLength({ max: 300 }),
    body("cards.*.front_text").optional().isString().isLength({ max: 300 }),
    body("cards.*.back").optional().isString().isLength({ max: 300 }),
    body("cards.*.back_text").optional().isString().isLength({ max: 300 }),
];

export const generateAiFlashcardSetValidation = [
    body("subject_id").isInt({ min: 1 }).withMessage("subject_id must be a positive integer."),
    body("topic").optional({ nullable: true }).isString().isLength({ max: 200 }),
    body("prompt").optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body("count").optional().isInt({ min: 1, max: 30 }),
    body("difficulty").optional().isIn(["easy", "medium", "hard"]),
];

export const submitReviewEventValidation = [
    setParam(),
    body("session_id").isInt({ min: 1 }),
    body("card_id").isInt({ min: 1 }),
    body("result").isIn(["easy", "hard"]),
];

export const completeStudyValidation = [
    setParam(),
    body("session_id").isInt({ min: 1 }),
    body("duration_sec").optional().isInt({ min: 0 }),
];
