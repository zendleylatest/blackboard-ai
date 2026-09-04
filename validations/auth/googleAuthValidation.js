import { body } from "express-validator";

export const googleAuthValidation = [

    body("id_token")
        .notEmpty()
        .withMessage("Google ID token is required."),

];