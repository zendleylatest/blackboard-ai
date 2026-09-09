import HttpError from "../../utils/httpError.js";

import crypto from "crypto";
import {
    profileImageUrl,
    writeProfileImage,
} from "../../utils/localStorage.js";

import {
    updateProfileImage,
} from "../../models/auth/UserProfile.js";

const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
];

const ALLOWED_EXTENSIONS = [
    "jpg",
    "jpeg",
    "png",
    "webp",
];

const MAX_FILE_SIZE =
    5 * 1024 * 1024;

export const uploadProfileImageService = async (
    userId,
    file
) => {

    // ======================================================
    // VALIDATE FILE
    // ======================================================

    if (!file) {

        throw new HttpError(
            "No image file provided.",
            400
        );

    }

    // ======================================================
    // VALIDATE FILE TYPE
    // ======================================================

    const fileExtension =
        file.originalname
            .split(".")
            .pop()
            .toLowerCase();

    const isValidMimeType =
        ALLOWED_MIME_TYPES.includes(
            file.mimetype
        );

    const isValidExtension =
        ALLOWED_EXTENSIONS.includes(
            fileExtension
        );

    if (
        !isValidMimeType ||
        !isValidExtension
    ) {

        throw new HttpError(
            "Invalid image format. Only JPEG, PNG, and WebP are allowed.",
            400
        );

    }

    // ======================================================
    // VALIDATE FILE SIZE
    // ======================================================

    if (
        file.size >
        MAX_FILE_SIZE
    ) {

        throw new HttpError(
            "Image size must be less than 5MB.",
            400
        );

    }

    // ======================================================
    // UPLOAD IMAGE
    // ======================================================

    const storageKey =
        `${userId}/${crypto.randomUUID()}.${fileExtension}`;

    await writeProfileImage(
        storageKey,
        file.buffer
    );

    const profileImagePath =
        profileImageUrl(storageKey);

    // ======================================================
    // UPDATE PROFILE
    // ======================================================

    await updateProfileImage(
        userId,
        profileImagePath
    );

    // ======================================================
    // RETURN
    // ======================================================

    return {

        profileImagePath,

    };

};
