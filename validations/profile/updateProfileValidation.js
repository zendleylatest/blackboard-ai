import {
    body,
} from "express-validator";


export const updateProfileValidation = [

    body("full_name")
        .optional()
        .isString()
        .withMessage("Full name must be a string.")
        .trim()
        .notEmpty()
        .withMessage("Full name cannot be empty."),

    body("class_level")
        .optional()
        .isString()
        .withMessage("Class level must be a string.")
        .custom((value) => {

            const normalizedValue =
                value === "O Level"
                    ? "O"
                    : value === "A Level"
                        ? "A"
                        : value;

            if (!["O", "A"].includes(normalizedValue)) {
                throw new Error(
                    'Class level must be "O", "A", "O Level", or "A Level".'
                );
            }

            return true;

        }),

    body("age")
        .optional()
        .isInt({
            min: 10,
            max: 100,
        })
        .withMessage(
            "Age must be between 10 and 100."
        ),

    body("exam_board")
        .optional()
        .isString()
        .withMessage("Exam board must be a string.")
        .trim()
        .notEmpty()
        .withMessage("Exam board cannot be empty."),

];
