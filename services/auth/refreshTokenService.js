import HttpError from "../../utils/httpError.js";

import {
    verifyRefreshToken,
    generateAccessToken,
} from "../../utils/jwt.js";

import {
    findUserByIdSafe,
} from "../../models/auth/User.js";

export const refreshTokenService = async ({
    refresh,
}) => {

    let decodedToken;

    try {

        decodedToken =
            verifyRefreshToken(
                refresh
            );

    } catch (error) {

        throw new HttpError(
            "Invalid or expired refresh token.",
            401
        );

    }

    const user =
        await findUserByIdSafe(
            decodedToken.id
        );

    if (!user) {

        throw new HttpError(
            "User not found.",
            401
        );

    }

    if (!user.is_active) {

        throw new HttpError(
            "User account is inactive.",
            403
        );

    }

    return {

        access:
            generateAccessToken(
                user
            ),

    };

};
