import express from "express";

import {
    validate,
} from "../../middleware/validate.js";

import {
    updateProfileValidation,
} from "../../validations/profile/updateProfileValidation.js";

import {
    getUserProfileController,
} from "../../controllers/profile/getUserProfileController.js";

import {
    updateUserProfileController,
} from "../../controllers/profile/updateUserProfileController.js";

import {
    uploadProfileImage,
} from "../../middleware/upload.js";

import {
    uploadProfileImageController,
} from "../../controllers/profile/uploadProfileImageController.js";

import {
    authenticate,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

// Get current user profile
router.get(
    "/",
    authenticate,
    getUserProfileController
);

// Update current user profile
router.put(
    "/update",
    authenticate,
    updateProfileValidation,
    validate,
    updateUserProfileController
);

// Upload profile image
router.post(
    "/upload-image",
    authenticate,
    uploadProfileImage,
    uploadProfileImageController
);


export default router;
