import HttpError from "../../utils/httpError.js";

import {
    findUserByIdSafe,
} from "../../models/auth/User.js";

export const getUserProfileService = async (
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

    return user;

};
