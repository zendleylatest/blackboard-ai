import HttpError from "../../utils/httpError.js";

import {
    getConnection,
} from "../../config/database.js";

import {
    findUserByIdSafe,
    markProfileCompleted,
} from "../../models/auth/User.js";

import {
    findUserProfileByUserId,
    createUserProfile,
    updateUserProfile,
} from "../../models/auth/UserProfile.js";

export const completeProfileService = async ({
    userId,
    age,
    class_level,
}) => {

    const user =
        await findUserByIdSafe(
            userId
        );

    if (!user) {

        throw new HttpError(
            "User not found.",
            404
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Only Social Login Users
    |--------------------------------------------------------------------------
    */

    if (
        !["google", "apple"].includes(
            user.auth_provider
        )
    ) {

        throw new HttpError(
            "This endpoint is only for Google or Apple sign-in users.",
            400
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Prevent Duplicate Completion
    |--------------------------------------------------------------------------
    */

    if (
        Boolean(user.profile_completed)
    ) {

        throw new HttpError(
            "Profile already completed.",
            400
        );

    }

    /*
    |--------------------------------------------------------------------------
    | Normalize Age
    |--------------------------------------------------------------------------
    */

    const parsedAge =
        age === undefined ||
        age === null ||
        age === ""
            ? null
            : Number(age);

    const connection =
        await getConnection();

    try {

        await connection.beginTransaction();

        const existingProfile =
            await findUserProfileByUserId(
                user.id,
                connection
            );

        const profileData = {

            userId: user.id,

            fullName:
                user.username,

            age:
                parsedAge,

            classLevel:
                class_level,

            examBoard:
                "cambridge",

        };

        if (existingProfile) {

            await updateUserProfile(
                profileData,
                connection
            );

        } else {

            await createUserProfile(
                profileData,
                connection
            );

        }

        await markProfileCompleted(
            user.id,
            connection
        );

        await connection.commit();

        const updatedUser =
            await findUserByIdSafe(
                user.id
            );

        return {

            message:
                "Profile completed successfully.",

            user:
                updatedUser,

        };

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }

};
