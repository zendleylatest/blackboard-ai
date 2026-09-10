import { body, param } from "express-validator";

export const managedUserIdValidation = [
    param("userId").isInt({ min: 1 }).withMessage("A valid user ID is required."),
];

export const updateManagedUserValidation = [
    ...managedUserIdValidation,
    body("username").trim().isLength({ min: 1, max: 150 }),
    body("email").trim().isEmail().normalizeEmail(),
    body("full_name").trim().isLength({ min: 1, max: 100 }),
    body("age").optional({ nullable: true }).isInt({ min: 1, max: 120 }),
    body("class_level").isIn(["O", "A"]),
    body("exam_board").isIn(["cambridge", "edexcel", "aqa", "ocr", "wjec"]),
    body("is_active").isBoolean(),
    body("is_verified").isBoolean(),
    body("profile_completed").isBoolean(),
    body("subscription_action").optional().isIn(["unchanged", "grant", "revoke"]),
    body("subscription_tier")
        .if(body("subscription_action").equals("grant"))
        .isIn(["plus", "pro"]),
    body("subscription_expires_at")
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage("Subscription expiry must be a valid date."),
];
