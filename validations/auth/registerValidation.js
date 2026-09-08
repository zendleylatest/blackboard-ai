import { body } from "express-validator";

export const registerValidation = [
    body("username")
        .trim()
        .notEmpty()
        .withMessage("Username is required.")
        .isLength({ min: 3, max: 150 })
        .withMessage("Username must be between 3 and 150 characters.")
        .matches(/^[a-zA-Z0-9@.+_-]+$/)
        .withMessage("Username can only contain letters, numbers, and @ . + - _ characters."),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required.")
        .isEmail()
        .withMessage("Please enter a valid email.")
        .customSanitizer((value) => value.trim().toLowerCase()),

    body("password")
        .notEmpty()
        .withMessage("Password is required.")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters."),

    body("full_name")
        .trim()
        .notEmpty()
        .withMessage("Full name is required.")
        .isLength({ max: 100 })
        .withMessage("Full name cannot exceed 100 characters."),

    body("class_level")
        .notEmpty()
        .withMessage("Class level is required.")
        .isIn(["O", "A"])
        .withMessage("Class level must be O or A."),

    body("age")
        .optional({ nullable: true })
        .isInt({ min: 1, max: 100 })
        .withMessage("Age must be a valid number."),

    body("exam_board")
        .optional()
        .isIn([
            "cambridge",
            "edexcel",
            "aqa",
            "ocr",
            "wjec",
        ])
        .withMessage("Invalid exam board."),

    body("subject_ids")
        .optional()
        .isArray()
        .withMessage("Subject IDs must be an array."),

    body("subject_ids.*")
        .optional()
        .isInt()
        .withMessage("Each subject ID must be an integer."),
];
