import {
    getSubjects,
    enrollUserInSubject,
    unenrollUserFromSubject,
} from "../../services/subjects/subjectService.js";

import {
    errorResponse,
    successResponse,
} from "../../utils/apiResponse.js";
import { paginatedResponse } from "../../utils/pagination.js";

export const getSubjectsController = async (
    req,
    res
) => {
    try {
        const subjects = await getSubjects({
            userId: req.user?.id || null,
            isAuthenticated: Boolean(req.user),
            level: req.query.level || null,
            examBoard: req.query.exam_board || null,
            page: req.query.page,
        });

        return res.status(200).json(paginatedResponse({
            req,
            count: subjects.count,
            results: subjects.rows,
            page: subjects.page,
        }));
    } catch (error) {
        console.error(
            "Get subjects error:",
            error
        );

        return errorResponse(
            res,
            error.statusCode || 500,
            error.statusCode
                ? error.message
                : "Failed to retrieve subjects"
        );
    }
};

export const enrollSubjectController = async (
    req,
    res
) => {
    try {
        const result =
            await enrollUserInSubject(
                req.user.id,
                req.params.subject_id
            );

        return successResponse(
            res,
            result.created ? 201 : 200,
            result.created
                ? `Successfully enrolled in ${result.subject.name}`
                : `Already enrolled in ${result.subject.name}`,
            {
                subject: result.subject,
                already_enrolled: !result.created,
            }
        );
    } catch (error) {
        console.error(
            "Enroll subject error:",
            error
        );

        return errorResponse(
            res,
            error.statusCode || 500,
            error.statusCode
                ? error.message
                : "Error enrolling in subject"
        );
    }
};

export const unenrollSubjectController = async (
    req,
    res
) => {
    try {
        const result =
            await unenrollUserFromSubject(
                req.user.id,
                req.params.subject_id
            );

        return successResponse(
            res,
            200,
            `Successfully removed from ${result.subject.name}`,
            {
                deleted_chat_threads:
                    result.deletedChatThreads,
            }
        );
    } catch (error) {
        console.error(
            "Unenroll subject error:",
            error
        );

        return errorResponse(
            res,
            error.statusCode || 500,
            error.statusCode
                ? error.message
                : "Error removing from subject"
        );
    }
};
