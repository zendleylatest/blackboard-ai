import bcrypt from "bcrypt";

import HttpError from "../../utils/httpError.js";

import {
    generateOtp,
    generateOtpExpiry,
} from "../../utils/otp.js";

import { sendOtpEmail } from "../../services/emailService.js";

import {
    findUserByEmail,
} from "../../models/auth/User.js";

import {
    findPendingUserByEmail,
    deletePendingUserByEmail,
    createPendingUser,
    deletePendingUser,
} from "../../models/auth/PendingUser.js";

const maskEmail = (email = "") => {
    const [name, domain] = String(email).split("@");
    if (!domain) return "<invalid-email>";
    return `${name.slice(0, 2)}***@${domain}`;
};

export const registerService = async (data) => {

    const {
        email,
        username,
        password,
        full_name,
        age,
        class_level,
        exam_board = "cambridge",
        subject_ids = [],
    } = data;

    console.log(`[AUTH][REGISTER] Start email=${maskEmail(email)}`);

    /*
    |--------------------------------------------------------------------------
    | Check Existing User
    |--------------------------------------------------------------------------
    */

    const existingUser = await findUserByEmail(email);

    if (existingUser) {
        console.log(`[AUTH][REGISTER] Existing user found email=${maskEmail(email)}`);

        throw new HttpError(
            "An account with this email already exists.",
            409
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Remove Existing Pending Registration
    |--------------------------------------------------------------------------
    */

    const pendingUser = await findPendingUserByEmail(email);

    if (pendingUser) {
        console.log(`[AUTH][REGISTER] Removing previous pending user id=${pendingUser.id} email=${maskEmail(email)}`);

        await deletePendingUserByEmail(email);

    }

    /*
    |--------------------------------------------------------------------------
    | Hash Password
    |--------------------------------------------------------------------------
    */

    const hashedPassword = await bcrypt.hash(
        password,
        10
    );

    /*
    |--------------------------------------------------------------------------
    | Generate OTP
    |--------------------------------------------------------------------------
    */

    const otpCode = generateOtp();

    const otpExpiry = generateOtpExpiry();

    console.log(`[AUTH][REGISTER] Generated OTP email=${maskEmail(email)} expires=${otpExpiry.toISOString()}`);

    /*
    |--------------------------------------------------------------------------
    | Create Pending User
    |--------------------------------------------------------------------------
    */

    const pendingUserId = await createPendingUser({

        email,

        username:
            username ??
            email.split("@")[0],

        password: hashedPassword,

        fullName: full_name,

        age,

        classLevel: class_level,

        examBoard: exam_board,

        subjectIds: subject_ids,

        otpCode,

        otpExpiry,

    });

    console.log(`[AUTH][REGISTER] Pending user created id=${pendingUserId} email=${maskEmail(email)}`);

    /*
    |--------------------------------------------------------------------------
    | Send Verification Email
    |--------------------------------------------------------------------------
    */

    try {
        await sendOtpEmail({
            email,
            username: username ?? email.split("@")[0],
            otpCode,
        });

        console.log(`[AUTH][REGISTER] Verification email accepted email=${maskEmail(email)}`);

    } catch (error) {
        console.error(`[AUTH][REGISTER] Verification email failed email=${maskEmail(email)}: ${error?.message || error}`);

        await deletePendingUser(
            pendingUserId
        );

        throw new HttpError(
            "Failed to send verification email.",
            500
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Return Response
    |--------------------------------------------------------------------------
    */

    return {
        email,
    };

};
