import {
    deleteAccountService,
} from "../../services/auth/deleteAccountService.js";

import {
    successResponse,
} from "../../utils/apiResponse.js";

export const deleteAccountController = async (
    req,
    res,
    next
) => {

    try {

        const data =
            await deleteAccountService(
                req.user.id
            );

        return successResponse(
            res,
            200,
            data.message,
            {
                deleted:
                    data.deleted,
            }
        );

    } catch (error) {

        next(error);

    }

};
