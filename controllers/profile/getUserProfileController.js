import {
    getUserProfileService,
} from "../../services/profile/getUserProfileService.js";

import {
    successResponse,
} from "../../utils/apiResponse.js";

export const getUserProfileController = async (
    req,
    res,
    next
) => {

    try {

        const user =
            await getUserProfileService(
                req.user.id
            );

        return successResponse(
            res,
            200,
            "Profile retrieved successfully.",
            user
        );

    } catch (error) {

        next(error);

    }

};
