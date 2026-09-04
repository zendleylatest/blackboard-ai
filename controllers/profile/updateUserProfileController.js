import {
    updateUserProfileService,
} from "../../services/profile/updateUserProfileService.js";

import {
    successResponse,
} from "../../utils/apiResponse.js";

export const updateUserProfileController = async (
    req,
    res,
    next
) => {

    try {

        const user =
            await updateUserProfileService(
                req.user.id,
                req.body
            );

        return successResponse(
            res,
            200,
            "Profile updated successfully.",
            {
                user,
            }
        );

    } catch (error) {

        next(error);

    }

};
