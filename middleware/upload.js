import multer from "multer";

const storage =
    multer.memoryStorage();

export const uploadProfileImage =
    multer({

        storage,

        limits: {

            fileSize:
                5 * 1024 * 1024,

        },

    }).single(
        "image"
    );