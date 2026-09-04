import {
    body,
} from "express-validator";

export const completeProfileValidation = [

    body("class_level")
        .notEmpty()
        .withMessage(
            "class_level is required."
        )
        .isIn(["O", "A"])
        .withMessage(
            'class_level must be "O" or "A".'
        ),

    body("age")
        .optional({
            values: "falsy",
        })
        .isInt({
            min: 10,
            max: 100,
        })
        .withMessage(
            "Age must be between 10 and 100."
        ),

];