import {
    refreshTokenService,
} from "../../services/auth/refreshTokenService.js";

import {
    successResponse,
} from "../../utils/apiResponse.js";

export const refreshTokenController = async (
    req,
    res,
    next
) => {

    try {

        const data =
            await refreshTokenService(
                req.body
            );

        return successResponse(
            res,
            200,
            "Access token refreshed successfully.",
            data
        );

    } catch (error) {

        next(error);

    }

};
