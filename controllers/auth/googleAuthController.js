import {
    googleAuthService,
} from "../../services/auth/googleAuthService.js";

import {
    successResponse,
} from "../../utils/apiResponse.js";

export const googleAuthController = async (
    req,
    res,
    next
) => {

    try {

        const data =
            await googleAuthService(
                req.body
            );

        return successResponse(
            res,
            200,
            data.message,
            {
                tokens: data.tokens,

                user: data.user,

                profile_completed:
                    data.profile_completed,

                ...(data.needs_profile_completion !== undefined && {

                    needs_profile_completion:
                        data.needs_profile_completion,

                }),

            },
            data.message ===
                "Account created successfully."
                ? 201
                : 200
        );

    } catch (error) {

        next(error);

    }

};
