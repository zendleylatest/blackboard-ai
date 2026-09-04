import { body } from "express-validator";

export const verifyOtpValidation = [

    body("email")
        .notEmpty()
        .withMessage("Email is required.")
        .isEmail()
        .withMessage("Please enter a valid email address."),

    body("otp")
        .notEmpty()
        .withMessage("OTP is required.")
        .isLength({ min: 6, max: 6 })
        .withMessage("OTP must be 6 digits.")
        .isNumeric()
        .withMessage("OTP must contain only numbers."),

];