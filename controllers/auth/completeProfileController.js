import {
    completeProfileService,
} from "../../services/auth/completeProfileService.js";

import {
    successResponse,
} from "../../utils/apiResponse.js";

export const completeProfileController = async (
    req,
    res,
    next
) => {

    try {

        const data =
            await completeProfileService({

                userId:
                    req.user.id,

                age:
                    req.body.age,

                class_level:
                    req.body.class_level,

            });

        return successResponse(

            res,
            200,
            data.message,

            {
                user:
                    data.user,
            }

        );

    } catch (error) {

        next(error);

    }

};
