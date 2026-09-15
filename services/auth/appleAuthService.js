import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

import HttpError from "../../utils/httpError.js";

import {
    findUserByEmail,
    findUserByAppleId,
    findUserByIdSafe,
    createAppleUser,
    updateAppleId,
    updateLastLogin,
} from "../../models/auth/User.js";

import {
    findPendingUserByEmail,
} from "../../models/auth/PendingUser.js";

import {
    generateAccessToken,
    generateRefreshToken,
} from "../../utils/jwt.js";

import {
    generateUniqueUsername,
} from "./usernameService.js";

const appleJwksClient = jwksClient({
    jwksUri: "https://appleid.apple.com/auth/keys",
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000,
});

const getAppleSigningKey = async (header) => {

    if (!header.kid) {

        throw new HttpError(
            "Apple identity token missing key ID.",
            401
        );

    }

    const key =
        await appleJwksClient.getSigningKey(
            header.kid
        );

    return key.getPublicKey();

};

const verifyAppleIdentityToken = async (
    identityToken
) => {

    let decodedHeader;

    try {

        decodedHeader =
            jwt.decode(
                identityToken,
                {
                    complete: true,
                }
            )?.header;

    } catch (error) {

        throw new HttpError(
            "Invalid Apple identity token.",
            401
        );

    }

    if (!decodedHeader) {

        throw new HttpError(
            "Invalid Apple identity token.",
            401
        );

    }

    const publicKey =
        await getAppleSigningKey(
            decodedHeader
        );

    const acceptedAudiences = [
        process.env.APPLE_BUNDLE_ID,
        process.env.APPLE_CLIENT_ID,
        process.env.APPLE_SERVICE_ID,
    ].filter(Boolean);

    if (!acceptedAudiences.length) {
        throw new HttpError(
            500,
            "Apple authentication is not configured."
        );
    }

    const claims =
        jwt.verify(
            identityToken,
            publicKey,
            {
                algorithms: ["RS256"],
                issuer: "https://appleid.apple.com",
                audience: acceptedAudiences,
            }
        );

    return claims;

};

export const appleAuthService = async ({
    identity_token,
    email,
    full_name,
}) => {

    /*
    |--------------------------------------------------------------------------
    | Verify Identity Token
    |--------------------------------------------------------------------------
    */

    const claims =
        await verifyAppleIdentityToken(
            identity_token
        );

    /*
    |--------------------------------------------------------------------------
    | Extract Apple Identity
    |--------------------------------------------------------------------------
    */

    const appleUserId =
        claims.sub;

    if (!appleUserId) {

        throw new HttpError(
            "Apple token missing subject (sub) claim.",
            400
        );

    }

    // Prefer the verified token email.
    // Apple normally supplies email only on the first authorization. If the
    // backend account is later deleted, the same Apple identity must still be
    // able to create a new account without requiring the user to revoke Apple
    // access in iOS Settings first. Use a stable, non-PII internal address
    // when Apple no longer returns the original address.
    const fallbackEmail =
        `apple_${crypto
            .createHash("sha256")
            .update(appleUserId)
            .digest("hex")
            .slice(0, 24)}@users.blackboardai.app`;

    const userEmail =
        claims.email ||
        email ||
        fallbackEmail;

    const fullName =
        full_name?.trim() || "";

    /*
    |--------------------------------------------------------------------------
    | Existing Apple User
    |--------------------------------------------------------------------------
    */

    const existingAppleUser =
        await findUserByAppleId(
            appleUserId
        );

    if (existingAppleUser) {

        if (!existingAppleUser.is_active) {
            throw new HttpError(
                "This account has been suspended. Contact support if you believe this is a mistake.",
                403
            );
        }

        await updateLastLogin(
            existingAppleUser.id
        );

        const user =
            await findUserByIdSafe(
                existingAppleUser.id
            );

        return {

            message: "Login successful.",

            tokens: {

                access:
                    generateAccessToken(user),

                refresh:
                    generateRefreshToken(user),

            },

            user,

            profile_completed:
                Boolean(user.profile_completed),

        };

    }

    /*
    |--------------------------------------------------------------------------
    | Email/Password Account Conflict
    |--------------------------------------------------------------------------
    */

    const existingEmailUser =
        await findUserByEmail(
            userEmail
        );

    if (
        existingEmailUser &&
        existingEmailUser.auth_provider === "email"
    ) {

        throw new HttpError(
            "An account with this email already exists. Please sign in with email and password.",
            409
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Google Account Conflict
    |--------------------------------------------------------------------------
    */

    if (
        existingEmailUser &&
        existingEmailUser.auth_provider === "google"
    ) {

        throw new HttpError(
            "An account with this email already exists via Google Sign-In. Please use Google to sign in.",
            409
        );

    }

    if (
        existingEmailUser &&
        existingEmailUser.auth_provider === "apple"
    ) {

        if (!existingEmailUser.is_active) {
            throw new HttpError(
                "This account has been suspended. Contact support if you believe this is a mistake.",
                403
            );
        }

        if (existingEmailUser.apple_user_id !== appleUserId) {
            await updateAppleId(
                existingEmailUser.id,
                appleUserId
            );
        }

        await updateLastLogin(
            existingEmailUser.id
        );

        const user =
            await findUserByIdSafe(
                existingEmailUser.id
            );

        return {

            message: "Login successful.",

            tokens: {

                access:
                    generateAccessToken(user),

                refresh:
                    generateRefreshToken(user),

            },

            user,

            profile_completed:
                Boolean(user.profile_completed),

        };

    }

    /*
    |--------------------------------------------------------------------------
    | Pending Registration Conflict
    |--------------------------------------------------------------------------
    */

    const pendingUser =
        await findPendingUserByEmail(
            userEmail
        );

    if (pendingUser) {

        throw new HttpError(
            "This email has a pending registration. Please verify your email first or use a different email.",
            409
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Create Apple User
    |--------------------------------------------------------------------------
    */

    const preferredUsername =
        fullName ||
        userEmail.split("@")[0] ||
        `apple_user_${appleUserId.slice(0, 8)}`;

    const username =
        await generateUniqueUsername({
            preferred: preferredUsername,
            stableId: appleUserId,
        });

    const randomPassword =
        crypto.randomBytes(32).toString("hex");

    const hashedPassword =
        await bcrypt.hash(randomPassword, 10);

    const userId =
        await createAppleUser({

            username,

            email: userEmail,

            appleUserId,

            password: hashedPassword,

        });

    const user =
        await findUserByIdSafe(
            userId
        );

    return {

        message: "Account created successfully.",

        tokens: {

            access:
                generateAccessToken(user),

            refresh:
                generateRefreshToken(user),

        },

        user,

        profile_completed: false,

        needs_profile_completion: true,

    };

};
