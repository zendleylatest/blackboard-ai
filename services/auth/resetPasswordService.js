import bcrypt from "bcrypt";

import HttpError from "../../utils/httpError.js";
import { isOtpValid } from "../../utils/otp.js";

import {
    findUserByEmail,
    updateUserPassword,
    clearUserOtp,
} from "../../models/auth/User.js";

export const resetPasswordService = async ({
    email,
    otp,
    new_password,
}) => {

    /*
    |--------------------------------------------------------------------------
    | Find User
    |--------------------------------------------------------------------------
    */

    const user = await findUserByEmail(email);

    if (!user || user.auth_provider !== "email") {

        throw new HttpError(
            "User not found.",
            404
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Validate OTP
    |--------------------------------------------------------------------------
    */

    if (!isOtpValid(user.otp_code, user.otp_expiry, otp)) {
            throw new HttpError(
                "Invalid or expired OTP.",
                400
            );
        }

    /*
    |--------------------------------------------------------------------------
    | Hash New Password
    |--------------------------------------------------------------------------
    */

    const hashedPassword = await bcrypt.hash(
        new_password,
        10
    );

    /*
    |--------------------------------------------------------------------------
    | Update Password
    |--------------------------------------------------------------------------
    */

    await updateUserPassword(
        user.id,
        hashedPassword
    );

    /*
    |--------------------------------------------------------------------------
    | Clear OTP
    |--------------------------------------------------------------------------
    */

    await clearUserOtp(
        user.id
    );

    /*
    |--------------------------------------------------------------------------
    | Return
    |--------------------------------------------------------------------------
    */

    return {

        message:
            "Password reset successfully. You can now login with your new password.",

    };

};
