import HttpError from "../../utils/httpError.js";

import {
    findUserByIdSafe,
} from "../../models/auth/User.js";

import {
    findUserProfileByUserId,
    updateUserProfile,
} from "../../models/auth/UserProfile.js";

export const updateUserProfileService = async (
    userId,
    data
) => {

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

    const profile =
        await findUserProfileByUserId(
            userId
        );

    if (!profile) {

        throw new HttpError(
            "User profile not found.",
            404
        );

    }

    const {

        full_name:
            fullName = profile.full_name,

        age =
            data.age !== undefined
                ? data.age
                : profile.age,

        class_level:
            classLevelInput =
                profile.class_level,

        exam_board:
            examBoard =
                data.exam_board !== undefined
                    ? data.exam_board
                    : profile.exam_board,

        phone =
            data.phone !== undefined
                ? data.phone
                : profile.phone,

    } = data;

    const classLevel =
        classLevelInput === "O Level"
            ? "O"
            : classLevelInput === "A Level"
                ? "A"
                : classLevelInput;

    await updateUserProfile({

        userId,

        fullName,

        age,

        classLevel,

        examBoard,

        phone,

    });

    const updatedProfile =
        await findUserProfileByUserId(
            userId
        );

    return {

        ...user,

        profile:
            updatedProfile,

    };

};
