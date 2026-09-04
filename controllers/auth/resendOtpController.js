import { resendOtpService } from "../../services/auth/resendOtpService.js";

import { successResponse } from "../../utils/apiResponse.js";

export const resendOtpController = async (
    req,
    res,
    next
) => {

    try {

        const data = await resendOtpService(req.body);

        return successResponse(
            res,
            200,
            "Verification code resent successfully. Please check your email.",
            data
        );

    } catch (error) {

        next(error);

    }

};
