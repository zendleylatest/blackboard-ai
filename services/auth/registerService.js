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
    deleteExpiredPendingUserByUsername,
    createPendingUser,
    deletePendingUser,
} from "../../models/auth/PendingUser.js";

import {
    isUsernameAvailable,
} from "./usernameService.js";

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
        age = null,
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
            "An account already exists with this email. Please log in or use a different email address.",
            409
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Remove Superseded or Expired Pending Registration
    |--------------------------------------------------------------------------
    */

    const pendingUser = await findPendingUserByEmail(email);

    if (pendingUser) {
        console.log(`[AUTH][REGISTER] Removing previous pending user id=${pendingUser.id} email=${maskEmail(email)}`);

        await deletePendingUserByEmail(email);

    }

    await deleteExpiredPendingUserByUsername(username);

    const usernameAvailable = await isUsernameAvailable(username);

    if (!usernameAvailable) {

        throw new HttpError(
            "That username is already taken. Please choose another username.",
            409
        );

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

        username,

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
        const emailSent = await sendOtpEmail({
            email,
            username,
            otpCode,
        });

        if (!emailSent) {
            throw new Error("Email provider rejected the verification email.");
        }

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
