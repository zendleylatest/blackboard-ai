import { body } from "express-validator";

export const forgotPasswordValidation = [

    body("email")
        .notEmpty()
        .withMessage("Email is required.")
        .isEmail()
        .withMessage("Please enter a valid email address.")
        .customSanitizer((value) => value.trim().toLowerCase()),

];
