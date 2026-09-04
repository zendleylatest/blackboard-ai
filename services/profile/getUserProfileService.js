import HttpError from "../../utils/httpError.js";

import {
    findUserByIdSafe,
} from "../../models/auth/User.js";

import {
    findUserProfileByUserId,
} from "../../models/auth/UserProfile.js";

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

    const profile =
        await findUserProfileByUserId(
            userId
        );

    return {

        ...user,

        profile,

    };

};
