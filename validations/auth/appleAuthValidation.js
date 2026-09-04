import { body } from "express-validator";

export const appleAuthValidation = [

    body("identity_token")
        .notEmpty()
        .withMessage(
            "Apple identity token is required."
        ),

    body("email")
        .optional()
        .isEmail()
        .withMessage(
            "Please provide a valid email address."
        ),

    body("full_name")
        .optional()
        .isString()
        .withMessage(
            "Full name must be a string."
        ),

];