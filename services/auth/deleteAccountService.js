import HttpError from "../../utils/httpError.js";

import {
    findUserByIdSafe,
    deleteUserById,
} from "../../models/auth/User.js";

export const deleteAccountService = async (
    userId
) => {

    const user =
        await findUserByIdSafe(
            userId
        );

    if (!user) {

        throw new HttpError(
            "User not found.",
            404
        );

    }

    const deleted =
        await deleteUserById(
            user.id
        );

    if (!deleted) {

        throw new HttpError(
            "Failed to delete account.",
            500
        );

    }

    console.info(
        `Account deleted: user_id=${user.id}, email=${user.email}`
    );

    return {

        deleted: true,

        message:
            "Your account and all associated data have been permanently deleted.",

    };

};
