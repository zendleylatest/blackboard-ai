import {
    body,
} from "express-validator";

export const refreshTokenValidation = [

    body("refresh")
        .trim()
        .notEmpty()
        .withMessage(
            "Refresh token is required."
        ),

];