import {
    findActiveSubjectsPage,
    findActiveSubjectById,
    findUserSubject,
    createUserSubject,
    deleteUserSubject,
} from "../../models/subjects/Subject.js";

import HttpError from "../../utils/httpError.js";
import { PAGE_SIZE, getPage } from "../../utils/pagination.js";

export const getSubjects = async ({
    userId = null,
    isAuthenticated = false,
    level = null,
    examBoard = null,
    page = 1,
}) => {
    const safePage = getPage(page);
    const result = await findActiveSubjectsPage(
        {
            userId: isAuthenticated ? userId : null,
            level,
            examBoard,
        },
        {
            limit: PAGE_SIZE,
            offset: (safePage - 1) * PAGE_SIZE,
        }
    );

    return { ...result, page: safePage };
};

export const enrollUserInSubject = async (
    userId,
    subjectId
) => {
    const subject = await findActiveSubjectById(
        subjectId
    );

    if (!subject) {
        throw new HttpError(
            404,
            "Subject not found"
        );
    }

    const existingEnrollment =
        await findUserSubject(
            userId,
            subjectId
        );

    if (existingEnrollment) {
        return {
            subject,
            created: false,
        };
    }

    try {
        await createUserSubject(
            userId,
            subjectId
        );
    } catch (error) {
        /*
        |--------------------------------------------------------------------------
        | Database unique constraint protection
        |--------------------------------------------------------------------------
        |
        | The application checks first for a clean response, but the database
        | remains the final protection against concurrent duplicate requests.
        |
        */
        if (
            error.code === "ER_DUP_ENTRY" ||
            error.code === "23000"
        ) {
            return {
                subject,
                created: false,
            };
        }

        throw error;
    }

    return {
        subject,
        created: true,
    };
};

export const unenrollUserFromSubject = async (
    userId,
    subjectId
) => {
    const subject = await findActiveSubjectById(
        subjectId
    );

    if (!subject) {
        throw new HttpError(
            404,
            "Subject not found"
        );
    }

    const enrollment = await findUserSubject(
        userId,
        subjectId
    );

    if (!enrollment) {
        return {
            subject,
            deletedChatThreads: 0,
        };
    }

    await deleteUserSubject(
        userId,
        subjectId
    );

    /*
    |--------------------------------------------------------------------------
    | ChatThread cleanup
    |--------------------------------------------------------------------------
    |
    | Django deletes all chat threads for this user and subject after
    | unenrollment. ChatThread is a separate feature, so the cleanup is
    | intentionally kept isolated here rather than duplicating ChatThread
    | logic in the subject model.
    |
    | This will be connected to the ChatThread model/service when that feature
    | is migrated.
    |--------------------------------------------------------------------------
    */

    let deletedChatThreads = 0;

    return {
        subject,
        deletedChatThreads,
    };
};
