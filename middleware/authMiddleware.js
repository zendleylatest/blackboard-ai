import {
    verifyAccessToken,
} from "../utils/jwt.js";

import {
    findUserByIdSafe,
} from "../models/auth/User.js";

import HttpError from "../utils/httpError.js";

export const authenticate = async (
    req,
    res,
    next
) => {

    try {

        const authHeader =
            req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {

            throw new HttpError(
                401,
                "Authorization token is required."
            );

        }

        const token =
            authHeader.split(" ")[1];

        const decoded =
            verifyAccessToken(token);

        const user =
            await findUserByIdSafe(
                decoded.id
            );

        if (!user) {

            throw new HttpError(
                401,
                "User not found."
            );

        }

        if (!user.is_active) {

            throw new HttpError(
                403,
                "User account is inactive."
            );

        }

        req.user = user;

        next();

    } catch (error) {

        next(
            error.statusCode
                ? error
                : new HttpError(
                    401,
                    "Invalid or expired access token."
                )
        );

    }

};

// Match DRF AllowAny endpoints: anonymous requests are accepted, while a
// supplied bearer token is still validated and exposes req.user.
export const optionalAuthenticate = (req, res, next) => {
    if (!req.headers.authorization) {
        return next();
    }

    return authenticate(req, res, next);
};
