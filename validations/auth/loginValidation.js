import { body } from "express-validator";

export const loginValidation = [

    body("email")
        .isEmail()
        .withMessage("A valid email is required."),

    body("password")
        .notEmpty()
        .withMessage("Password is required."),

];