import { validationResult } from "express-validator";

import { validationErrorResponse } from "../utils/apiResponse.js";

export const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
        return next();
    }

    return validationErrorResponse(
        res,
        errors.array().map((error) => ({
            field: error.path,
            message: error.msg,
        }))
    );
};