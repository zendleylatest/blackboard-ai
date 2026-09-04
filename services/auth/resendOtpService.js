import HttpError from "../../utils/httpError.js";

import {
    findPendingUserByEmail,
    updatePendingUserOtp,
} from "../../models/auth/PendingUser.js";

import {
    findUserByEmail,
    updateUserOtp,
} from "../../models/auth/User.js";

import {
    generateOtp,
    generateOtpExpiry,
} from "../../utils/otp.js";

import {
    sendOtpEmail,
} from "../../services/emailService.js";

export const resendOtpService = async ({
    email,
}) => {

    /*
    |--------------------------------------------------------------------------
    | Pending Registration
    |--------------------------------------------------------------------------
    */

    const pendingUser = await findPendingUserByEmail(email);

    if (pendingUser) {

        const otpCode = generateOtp();
        const otpExpiry = generateOtpExpiry();

        await updatePendingUserOtp(
            pendingUser.id,
            otpCode,
            otpExpiry
        );

        const emailSent = await sendOtpEmail({
            email: pendingUser.email,
            username: pendingUser.username,
            otpCode,
        });

        if (!emailSent) {
            throw new HttpError(
                "Failed to send verification email. Please try again.",
                500
            );
        }

        return {
            email: pendingUser.email,
        };

    }

    /*
    |--------------------------------------------------------------------------
    | Existing User
    |--------------------------------------------------------------------------
    */

    const user = await findUserByEmail(email);

    if (!user) {

        throw new HttpError(
            "No pending registration or user found for this email.",
            404
        );

    }

    if (user.is_verified) {

        throw new HttpError(
            "Email already verified.",
            400
        );

    }

    const otpCode = generateOtp();
    const otpExpiry = generateOtpExpiry();

    // Reuse the existing helper from userModel
    await updateUserOtp(
        user.id,
        otpCode,
        otpExpiry
    );

    const emailSent = await sendOtpEmail({
        email: user.email,
        username: user.username,
        otpCode,
    });

    if (!emailSent) {

        throw new HttpError(
            "Failed to send verification email. Please try again.",
            500
        );

    }

    return {
        email: user.email,
    };

};
