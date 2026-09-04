import { registerService } from "../../services/auth/registerService.js";

import { successResponse } from "../../utils/apiResponse.js";

export const registerController = async (req, res, next) => {
    try {
        const data = await registerService(req.body);

        return successResponse(
            res,
            201,
            "Registration initiated. Please check your email for the verification code.",
            data
        );
    } catch (error) {
        next(error);
    }
};