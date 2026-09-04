import {
    enrollUserInSubject,
    unenrollUserFromSubject,
} from "../../services/subjects/userSubjectService.js";

export const enrollSubjectController = async (
    req,
    res,
    next
) => {
    try {
        const userId = req.user.id;
        const subjectId = req.params.subject_id;

        const result =
            await enrollUserInSubject(
                userId,
                subjectId
            );

        return res.status(201).json({
            message: result.message,
        });
    } catch (error) {
        return next(error);
    }
};

export const unenrollSubjectController = async (
    req,
    res,
    next
) => {
    try {
        const userId = req.user.id;
        const subjectId = req.params.subject_id;

        const result =
            await unenrollUserFromSubject(
                userId,
                subjectId
            );

        return res.status(200).json({
            message: result.message,
            deleted_chat_threads:
                result.deleted_chat_threads,
        });
    } catch (error) {
        return next(error);
    }
};
