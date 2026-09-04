import {
    uploadProfileImageService,
} from "../../services/profile/uploadProfileImageService.js";

import {
    successResponse,
} from "../../utils/apiResponse.js";

export const uploadProfileImageController = async (
    req,
    res,
    next
) => {

    try {

        const data =
            await uploadProfileImageService(
                req.user.id,
                req.file
            );

        return successResponse(
            res,
            200,
            "Profile image uploaded successfully.",
            {
                profile_image_path:
                    data.profileImagePath,
            }
        );

    } catch (error) {

        next(error);

    }

};
