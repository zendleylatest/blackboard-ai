import {
    findSubjectById,
    findUserSubject,
    createUserSubject,
    deleteUserSubject,
} from "../../models/subjects/UserSubject.js";

import {
    deleteUserSubjectChatThreads,
} from "../chatThreadService.js";

/**
 * Enroll a user in an active subject.
 */
export const enrollUserInSubject = async (
    userId,
    subjectId
) => {
    const subject = await findSubjectById(
        subjectId
    );

    if (!subject) {
        const error = new Error(
            "Subject not found"
        );

        error.statusCode = 404;
        throw error;
    }

    const existingEnrollment =
        await findUserSubject(
            userId,
            subjectId
        );

    if (existingEnrollment) {
        const error = new Error(
            "Already enrolled in this subject"
        );

        error.statusCode = 400;
        throw error;
    }

    await createUserSubject(
        userId,
        subjectId
    );

    return {
        subject,
        message: `Successfully enrolled in ${subject.name}`,
    };
};

/**
 * Unenroll a user from an active subject.
 *
 * Also deletes all ChatThreads belonging to the
 * user and subject, matching the original Django behavior.
 */
export const unenrollUserFromSubject = async (
    userId,
    subjectId
) => {
    const subject = await findSubjectById(
        subjectId
    );

    if (!subject) {
        const error = new Error(
            "Subject not found"
        );

        error.statusCode = 404;
        throw error;
    }

    const enrollment =
        await findUserSubject(
            userId,
            subjectId
        );

    if (!enrollment) {
        const error = new Error(
            "Not enrolled in this subject"
        );

        error.statusCode = 400;
        throw error;
    }

    const deletedEnrollmentCount =
        await deleteUserSubject(
            userId,
            subjectId
        );

    const chatThreadDeleteResult =
        await deleteUserSubjectChatThreads(
            userId,
            subjectId
        );

    return {
        message: `Successfully removed from ${subject.name}`,
        deleted_chat_threads:
            chatThreadDeleteResult.affectedRows || 0,
        deleted_enrollment:
            deletedEnrollmentCount,
    };
};
