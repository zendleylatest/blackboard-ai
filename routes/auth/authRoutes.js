import express from "express";

import { validate } from "../../middleware/validate.js";

import { registerValidation } from "../../validations/auth/registerValidation.js";
import { registerController } from "../../controllers/auth/registerController.js";

import { resendOtpController } from "../../controllers/auth/resendOtpController.js";
import { resendOtpValidation } from "../../validations/auth/resendOtpValidation.js";

import { verifyOtpController } from "../../controllers/auth/verifyOtpController.js";
import { verifyOtpValidation } from "../../validations/auth/verifyOtpValidation.js";

import { loginController } from "../../controllers/auth/loginController.js";
import { loginValidation } from "../../validations/auth/loginValidation.js";

import { forgotPasswordController } from "../../controllers/auth/forgotPasswordController.js";
import { forgotPasswordValidation } from "../../validations/auth/forgotPasswordValidation.js";

import { resetPasswordController } from "../../controllers/auth/resetPasswordController.js";
import { resetPasswordValidation } from "../../validations/auth/resetPasswordValidation.js";

import { googleAuthController } from "../../controllers/auth/googleAuthController.js";
import { googleAuthValidation } from "../../validations/auth/googleAuthValidation.js";

import { appleAuthController } from "../../controllers/auth/appleAuthController.js";
import { appleAuthValidation } from "../../validations/auth/appleAuthValidation.js";

import { completeProfileController } from "../../controllers/auth/completeProfileController.js";
import { completeProfileValidation } from "../../validations/auth/completeProfileValidation.js";

import {
    refreshTokenValidation,
} from "../../validations/auth/refreshTokenValidation.js";

import {
    refreshTokenController,
} from "../../controllers/auth/refreshTokenController.js";

import {
    deleteAccountController,
} from "../../controllers/auth/deleteAccountController.js";

import { authenticate } from "../../middleware/authMiddleware.js";

const router = express.Router();

// Register
router.post(
    "/register",
    registerValidation,
    validate,
    registerController
);

// Verify OTP
router.post(
    "/verify-otp",
    verifyOtpValidation,
    validate,
    verifyOtpController
);

// Resend OTP
router.post(
    "/resend-otp",
    resendOtpValidation,
    validate,
    resendOtpController
);

// Forgot Password
router.post(
    "/forgot-password",
    forgotPasswordValidation,
    validate,
    forgotPasswordController
);

// Reset Password
router.post(
    "/reset-password",
    resetPasswordValidation,
    validate,
    resetPasswordController
);

// Login
router.post(
    "/login",
    loginValidation,
    validate,
    loginController
);

// Google Authentication
router.post(
    "/google",
    googleAuthValidation,
    validate,
    googleAuthController
);

// Apple Authentication
router.post(
    "/apple",
    appleAuthValidation,
    validate,
    appleAuthController
);

// Delete Account
router.delete(
    "/delete-account",
    authenticate,
    deleteAccountController
);

// Complete Social Login Profile
router.post(
    "/complete-profile",
    authenticate,
    completeProfileValidation,
    validate,
    completeProfileController
);


// Refresh Access Token
router.post(
    "/refresh",
    refreshTokenValidation,
    validate,
    refreshTokenController
);

//admin boostrap missing


export default router;