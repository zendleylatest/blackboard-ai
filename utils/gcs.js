import {
    Storage,
} from "@google-cloud/storage";

import crypto from "crypto";

const storage =
    new Storage();

const bucketName =
    process.env.GCS_BUCKET_NAME;

if (!bucketName) {

    throw new Error(
        "GCS_BUCKET_NAME environment variable is required."
    );

}

const bucket =
    storage.bucket(
        bucketName
    );

export const uploadProfileImage = async (
    file,
    userId
) => {

    const fileExtension =
        file.originalname
            .split(".")
            .pop()
            .toLowerCase();

    const fileName =
        `profile-images/${userId}/${crypto.randomUUID()}.${fileExtension}`;

    const blob =
        bucket.file(
            fileName
        );

    await blob.save(
        file.buffer,
        {
            metadata: {
                contentType:
                    file.mimetype,
            },
            resumable: false,
        }
    );

    return fileName;

};

export const generateSignedUrl = async (
    fileName,
    expiresInSeconds = 600
) => {

    const file =
        bucket.file(
            fileName
        );

    const [
        signedUrl,
    ] =
        await file.getSignedUrl({

            version: "v4",

            action: "read",

            expires:
                Date.now() +
                expiresInSeconds *
                1000,

        });

    return signedUrl;

};