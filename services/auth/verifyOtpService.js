import HttpError from "../../utils/httpError.js";

import { getConnection } from "../../config/database.js";

import {
    findPendingUserByEmail,
    deletePendingUser,
} from "../../models/auth/PendingUser.js";

import {
    findUserByEmail,
    findUserByIdSafe,
    createUser,
    verifyUser,
} from "../../models/auth/User.js";

import {
    createUserProfile,
} from "../../models/auth/UserProfile.js";

import {
    bulkCreateUserSubjects,
} from "../../models/auth/UserSubject.js";

import {
    generateAccessToken,
    generateRefreshToken,
} from "../../utils/jwt.js";

import { isOtpValid } from "../../utils/otp.js";

const maskEmail = (email = "") => {
    const [name, domain] = String(email).split("@");
    if (!domain) return "<invalid-email>";
    return `${name.slice(0, 2)}***@${domain}`;
};

export const verifyOtpService = async ({
    email,
    otp,
}) => {
    console.log(`[AUTH][VERIFY_OTP] Start email=${maskEmail(email)} otpLength=${String(otp || "").length}`);

    /*
    |--------------------------------------------------------------------------
    | Check Pending Registration
    |--------------------------------------------------------------------------
    */

    const pendingUser = await findPendingUserByEmail(email);

    if (pendingUser) {
        console.log(
            `[AUTH][VERIFY_OTP] Pending user found id=${pendingUser.id} email=${maskEmail(email)} expiry=${pendingUser.otp_expiry}`
        );

        if (!isOtpValid(pendingUser.otp_code, pendingUser.otp_expiry, otp)) {
            console.warn(
                `[AUTH][VERIFY_OTP] Invalid pending OTP email=${maskEmail(email)} hasStoredOtp=${Boolean(pendingUser.otp_code)} expiry=${pendingUser.otp_expiry}`
            );
            throw new HttpError(
                "Invalid or expired OTP.",
                400
            );
        }

        const connection = await getConnection();

        try {

            /*
            |--------------------------------------------------------------------------
            | Begin Transaction
            |--------------------------------------------------------------------------
            */

            await connection.beginTransaction();

            /*
            |--------------------------------------------------------------------------
            | Create User
            |--------------------------------------------------------------------------
            */

            const userId = await createUser(
                {
                    username: pendingUser.username,
                    email: pendingUser.email,
                    password: pendingUser.password,
                },
                connection
            );

            /*
            |--------------------------------------------------------------------------
            | Create Profile
            |--------------------------------------------------------------------------
            */

            await createUserProfile(
                {
                    userId,
                    fullName: pendingUser.full_name,
                    age: pendingUser.age,
                    classLevel: pendingUser.class_level,
                    examBoard: pendingUser.exam_board,
                },
                connection
            );

            /*
            |--------------------------------------------------------------------------
            | Enroll Subjects
            |--------------------------------------------------------------------------
            */

            if (pendingUser.subject_ids) {

                const subjectIds =
                    typeof pendingUser.subject_ids === "string"
                        ? JSON.parse(pendingUser.subject_ids)
                        : pendingUser.subject_ids;

                if (subjectIds.length > 0) {

                    await bulkCreateUserSubjects(
                        userId,
                        subjectIds,
                        connection
                    );

                }

            }

            /*
            |--------------------------------------------------------------------------
            | Remove Pending Registration
            |--------------------------------------------------------------------------
            */

            await deletePendingUser(
                pendingUser.id,
                connection
            );

            await connection.commit();

            /*
            |--------------------------------------------------------------------------
            | Return User
            |--------------------------------------------------------------------------
            */

            const user = await findUserByIdSafe(userId);

            console.log(`[AUTH][VERIFY_OTP] Pending user verified userId=${userId} email=${maskEmail(email)}`);

            return {

                message: "Email verified successfully.",

                tokens: {

                    access: generateAccessToken(user),

                    refresh: generateRefreshToken(user),

                },

                user,

            };

        } catch (error) {

            await connection.rollback();

            throw error;

        } finally {

            connection.release();

        }

    }

    /*
    |--------------------------------------------------------------------------
    | Existing User Verification
    |--------------------------------------------------------------------------
    */

    const user = await findUserByEmail(email);

    if (!user) {
        console.warn(`[AUTH][VERIFY_OTP] No pending user or existing user email=${maskEmail(email)}`);

        throw new HttpError(
            "No pending registration or user found for this email.",
            404
        );

    }

    if (!isOtpValid(user.otp_code, user.otp_expiry, otp)) {
        console.warn(
            `[AUTH][VERIFY_OTP] Invalid existing-user OTP userId=${user.id} email=${maskEmail(email)} hasStoredOtp=${Boolean(user.otp_code)} expiry=${user.otp_expiry}`
        );
        throw new HttpError(
            "Invalid or expired OTP.",
            400
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Verify Existing User
    |--------------------------------------------------------------------------
    */

    await verifyUser(user.id);

    const verifiedUser = await findUserByIdSafe(user.id);

    console.log(`[AUTH][VERIFY_OTP] Existing user verified userId=${user.id} email=${maskEmail(email)}`);

    return {

        message: "Email verified successfully.",

        tokens: {

            access: generateAccessToken(verifiedUser),

            refresh: generateRefreshToken(verifiedUser),

        },

        user: verifiedUser,

    };

};
