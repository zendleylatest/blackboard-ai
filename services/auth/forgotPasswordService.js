import {
    generateOtp,
    generateOtpExpiry,
} from "../../utils/otp.js";

import {
    sendOtpEmail,
} from "../../services/emailService.js";

import {
    findUserByEmail,
    updateUserOtp,
} from "../../models/auth/User.js";

import HttpError from "../../utils/httpError.js";

const maskEmail = (email = "") => {
    const [name, domain] = String(email).split("@");
    if (!domain) return "<invalid-email>";
    return `${name.slice(0, 2)}***@${domain}`;
};

export const forgotPasswordService = async ({
    email,
}) => {
    console.log(`[AUTH][FORGOT_PASSWORD] Start email=${maskEmail(email)}`);

    /*
    |--------------------------------------------------------------------------
    | Find User
    |--------------------------------------------------------------------------
    */

    const user = await findUserByEmail(email);

    console.log(
        `[AUTH][FORGOT_PASSWORD] Lookup email=${maskEmail(email)} found=${Boolean(user)} authProvider=${user?.auth_provider || "n/a"}`
    );

    /*
    |--------------------------------------------------------------------------
    | Security:
    | Never reveal whether the email exists.
    |--------------------------------------------------------------------------
    */

    if (!user || user.auth_provider !== "email") {
        const reason = !user ? "user_not_found" : "non_email_provider";
        const message = !user
            ? "No account was found with this email address. Please check the email or create a new account."
            : `This account uses ${user.auth_provider === "apple" ? "Apple" : "Google"} sign-in. Please continue with that option instead of resetting a password.`;

        console.warn(
            `[AUTH][FORGOT_PASSWORD] No reset email sent email=${maskEmail(email)} reason=${reason}`
        );

        return {
            email,
            email_sent: false,
            reason,
            message,
        };

    }

    /*
    |--------------------------------------------------------------------------
    | Generate OTP
    |--------------------------------------------------------------------------
    */

    const otpCode = generateOtp();

    const otpExpiry = generateOtpExpiry();

    console.log(`[AUTH][FORGOT_PASSWORD] Generated OTP userId=${user.id} email=${maskEmail(email)} expires=${otpExpiry.toISOString()}`);
    if (process.env.NODE_ENV !== "production") {
        console.log(`[AUTH][FORGOT_PASSWORD][DEV_OTP] ${otpCode}`);
    }

    /*
    |--------------------------------------------------------------------------
    | Save OTP
    |--------------------------------------------------------------------------
    */

    await updateUserOtp(
        user.id,
        otpCode,
        otpExpiry
    );

    console.log(`[AUTH][FORGOT_PASSWORD] Saved OTP userId=${user.id} email=${maskEmail(email)}`);

    /*
    |--------------------------------------------------------------------------
    | Send Email
    |--------------------------------------------------------------------------
    */

    const emailSent = await sendOtpEmail({
        email: user.email,
        username: user.username,
        otpCode,
    });

    if (!emailSent) {
        console.error(`[AUTH][FORGOT_PASSWORD] Reset email failed userId=${user.id} email=${maskEmail(email)}`);

        throw new HttpError(
            "Failed to send reset code.",
            500
        );

    }

    console.log(`[AUTH][FORGOT_PASSWORD] Reset email accepted userId=${user.id} email=${maskEmail(email)}`);

    /*
    |--------------------------------------------------------------------------
    | Return
    |--------------------------------------------------------------------------
    */

    return {

        email: user.email,
        email_sent: true,
        message: "Reset code sent to your email.",

    };

};
