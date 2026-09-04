import { verifyOtpService } from "../../services/auth/verifyOtpService.js";

import { successResponse } from "../../utils/apiResponse.js";

export const verifyOtpController = async (
    req,
    res,
    next
) => {

    try {

        const data = await verifyOtpService(req.body);

        return successResponse(
            res,
            200,
            data.message,
            {
                tokens: data.tokens,
                user: data.user,
            }
        );

    } catch (error) {

        next(error);

    }

};
