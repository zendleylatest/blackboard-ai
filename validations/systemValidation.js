import { body } from "express-validator";

export const bootstrapAdminValidation = [
    body("email").isEmail().normalizeEmail(),
    body("password").isString().isLength({ min: 8 }),
    body("full_name").optional().isString().isLength({ max: 100 }),
    body("age").optional().isInt({ min: 1, max: 120 }),
    body("class_level").optional().isString().isLength({ max: 10 }),
    body("exam_board").optional().isString().isLength({ max: 50 }),
    body("is_superuser").optional().isBoolean(),
    body("token").optional().isString(),
];
