import {
    forgotPasswordService,
} from "../../services/auth/forgotPasswordService.js";

import {
    successResponse,
} from "../../utils/apiResponse.js";

export const forgotPasswordController = async (
    req,
    res,
    next
) => {

    try {

        const data = await forgotPasswordService(
            req.body
        );

        return successResponse(
            res,
            200,
            data.message || "If this email exists, a reset code will be sent.",
            data
        );

    } catch (error) {

        next(error);

    }

};  
