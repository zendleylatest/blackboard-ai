import {
    resetPasswordService,
} from "../../services/auth/resetPasswordService.js";

import {
    successResponse,
} from "../../utils/apiResponse.js";

export const resetPasswordController = async (
    req,
    res,
    next
) => {

    try {

        const data = await resetPasswordService(
            req.body
        );

        return successResponse(
            res,
            200,
            data.message
        );

    } catch (error) {

        next(error);

    }

};
