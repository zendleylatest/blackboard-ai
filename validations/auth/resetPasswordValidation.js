import { body } from "express-validator";

export const resetPasswordValidation = [

    body("email")
        .notEmpty()
        .withMessage("Email is required.")
        .isEmail()
        .withMessage("Please enter a valid email address."),

    body("otp")
        .notEmpty()
        .withMessage("OTP is required.")
        .isLength({
            min: 6,
            max: 6,
        })
        .withMessage("OTP must be 6 digits.")
        .isNumeric()
        .withMessage("OTP must contain only numbers."),

    body("new_password")
        .notEmpty()
        .withMessage("New password is required.")
        .isLength({
            min: 8,
        })
        .withMessage(
            "Password must be at least 8 characters long."
        ),

];