import crypto from "crypto";
import bcrypt from "bcrypt";

import {
    OAuth2Client,
} from "google-auth-library";

import HttpError from "../../utils/httpError.js";

import {
    findUserByEmail,
    findUserByGoogleId,
    findUserByIdSafe,
    createGoogleUser,
    updateGoogleId,
    updateGooglePictureUrl,
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

const googleClient = new OAuth2Client();

export const googleAuthService = async ({
    id_token,
}) => {

    /*
    |--------------------------------------------------------------------------
    | Accepted Google Client IDs
    |--------------------------------------------------------------------------
    */

    const acceptedClientIds = [

        process.env.GOOGLE_CLIENT_ID,

        process.env.GOOGLE_IOS_CLIENT_ID,

    ].filter(Boolean);

    if (!acceptedClientIds.length) {

        throw new HttpError(
            "Google authentication is not configured.",
            500
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Verify Google ID Token
    |--------------------------------------------------------------------------
    */

    let payload = null;

    try {

        for (const clientId of acceptedClientIds) {

            try {

                const ticket =
                    await googleClient.verifyIdToken({
                        idToken: id_token,
                        audience: clientId,
                    });

                payload = ticket.getPayload();

                break;

            } catch (error) {

                // Try the next accepted client ID

            }

        }

        if (!payload) {

            throw new HttpError(
                "Invalid Google ID token.",
                401
            );

        }

    } catch (error) {

        if (error instanceof HttpError) {

            throw error;

        }

        throw new HttpError(
            "Invalid Google ID token.",
            401
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Extract Google User Information
    |--------------------------------------------------------------------------
    */

    const googleId = payload.sub;

    const email = payload.email;

    const isEmailVerified =
        payload.email_verified === true ||
        payload.email_verified === "true";

    const preferredUsername =
        payload.name ||
        email?.split("@")[0];

    const googlePictureUrl =
        payload.picture || null;

    if (!email) {

        throw new HttpError(
            "Email not provided by Google.",
            400
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Existing Google User
    |--------------------------------------------------------------------------
    */

    const existingGoogleUser =
        await findUserByGoogleId(googleId);

    if (existingGoogleUser) {

        if (!existingGoogleUser.is_active) {
            throw new HttpError(
                "This account has been suspended. Contact support if you believe this is a mistake.",
                403
            );
        }

        await updateLastLogin(
            existingGoogleUser.id
        );

        if (googlePictureUrl) {
            await updateGooglePictureUrl(
                existingGoogleUser.id,
                googlePictureUrl
            );
        }

        const user =
            await findUserByIdSafe(
                existingGoogleUser.id
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

    if (!isEmailVerified) {

        throw new HttpError(
            "Google email address is not verified.",
            401
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Existing Same-Email Account
    |--------------------------------------------------------------------------
    */

    const existingEmailUser =
        await findUserByEmail(email);

    if (
        existingEmailUser &&
        existingEmailUser.auth_provider === "email"
    ) {

        throw new HttpError(
            "An account with this email already exists. Please sign in with email and password.",
            409
        );

    }

    // Per explicit product decision, Google sign-in is allowed to log into
    // an account that was originally created via Apple, for the same
    // email — reverted from an earlier reciprocal block (Apple sign-in
    // still refuses to log into a Google-created account; only this
    // direction was reverted). Linking the Google id onto the existing
    // account (without changing its primary auth_provider) lets the user
    // in without creating a duplicate account for the same email.
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

        if (existingEmailUser.google_id !== googleId) {
            await updateGoogleId(
                existingEmailUser.id,
                googleId
            );
        }

        await updateLastLogin(
            existingEmailUser.id
        );

        if (googlePictureUrl) {
            await updateGooglePictureUrl(
                existingEmailUser.id,
                googlePictureUrl
            );
        }

        const linkedUser =
            await findUserByIdSafe(
                existingEmailUser.id
            );

        return {

            message: "Login successful.",

            tokens: {
                access:
                    generateAccessToken(linkedUser),

                refresh:
                    generateRefreshToken(linkedUser),
            },

            user: linkedUser,

            profile_completed:
                Boolean(linkedUser.profile_completed),

        };

    }

    if (
        existingEmailUser &&
        existingEmailUser.auth_provider === "google"
    ) {

        if (!existingEmailUser.is_active) {
            throw new HttpError(
                "This account has been suspended. Contact support if you believe this is a mistake.",
                403
            );
        }

        if (existingEmailUser.google_id !== googleId) {
            await updateGoogleId(
                existingEmailUser.id,
                googleId
            );
        }

        await updateLastLogin(
            existingEmailUser.id
        );

        if (googlePictureUrl) {
            await updateGooglePictureUrl(
                existingEmailUser.id,
                googlePictureUrl
            );
        }

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
    | Check Pending Email Registration
    |--------------------------------------------------------------------------
    */

    const pendingUser =
        await findPendingUserByEmail(email);

    if (pendingUser) {

        throw new HttpError(
            "This email has a pending registration. Please verify your email first or use a different email.",
            409
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Create New Google User
    |--------------------------------------------------------------------------
    */

    const randomPassword =
        crypto.randomBytes(32).toString("hex");

    const hashedPassword =
        await bcrypt.hash(randomPassword, 10);

    const username =
        await generateUniqueUsername({
            preferred: preferredUsername,
            stableId: googleId,
        });

    const userId =
        await createGoogleUser({

            username,

            // Google's raw display name (with spaces intact), kept separate
            // from the sanitized, underscore-safe `username` so the user's
            // real name can still be shown once their profile is completed.
            displayName: payload.name || null,

            email,

            googleId,

            password: hashedPassword,

            googlePictureUrl,

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
