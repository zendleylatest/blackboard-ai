import {
    successResponse,
    errorResponse,
    validationErrorResponse,
} from "../utils/apiResponse.js";

import {
    listUserQuizzes,
    getQuizDetail,
    startQuizAttempt,
    submitQuizAnswer,
    submitQuizAttempt,
    getQuizAttempts,
    getAttemptReview,
    markWrongReviewComplete,
    generateAiQuiz,
} from "../services/quizService.js";

export const generateAiQuizController = async (req, res, next) => {
    try {
        const result = await generateAiQuiz(req.user.id, {
            subjectId: req.body.subject_id,
            prompt: req.body.prompt,
            title: req.body.title,
            count: req.body.count,
            duration: req.body.duration,
            difficulty: req.body.difficulty,
        });

        return successResponse(
            res,
            201,
            "AI quiz generated successfully.",
            result
        );
    } catch (error) {
        next(error);
    }
};

export const listUserQuizzesController = async (
    req,
    res,
    next
) => {
    try {
        const quizzes =
            await listUserQuizzes(
                req.user.id,
                req.params.subjectId
            );

        return successResponse(
            res,
            200,
            "Quizzes retrieved successfully.",
            quizzes
        );
    } catch (error) {
        next(error);
    }
};

export const getQuizDetailController = async (
    req,
    res,
    next
) => {
    try {
        const quiz =
            await getQuizDetail(
                req.user.id,
                req.params.quizId
            );

        return successResponse(
            res,
            200,
            "Quiz retrieved successfully.",
            quiz
        );
    } catch (error) {
        next(error);
    }
};

export const startQuizAttemptController = async (
    req,
    res,
    next
) => {
    try {
        const attempt =
            await startQuizAttempt(
                req.user.id,
                req.params.quizId
            );

        return successResponse(
            res,
            201,
            "Quiz attempt started successfully.",
            attempt
        );
    } catch (error) {
        next(error);
    }
};

export const submitQuizAnswerController = async (
    req,
    res,
    next
) => {
    try {
        const result =
            await submitQuizAnswer(
                req.user.id,
                req.params.attemptId,
                req.body.question_id,
                req.body.choice_index
            );

        return successResponse(
            res,
            200,
            "Answer saved successfully.",
            result
        );
    } catch (error) {
        next(error);
    }
};

export const submitQuizAttemptController = async (
    req,
    res,
    next
) => {
    try {
        const result =
            await submitQuizAttempt(
                req.user.id,
                req.params.attemptId
            );

        return successResponse(
            res,
            200,
            "Quiz submitted successfully.",
            result
        );
    } catch (error) {
        next(error);
    }
};

export const getQuizAttemptsController = async (
    req,
    res,
    next
) => {
    try {
        const attempts =
            await getQuizAttempts(
                req.user.id,
                req.params.quizId
            );

        return successResponse(
            res,
            200,
            "Quiz attempts retrieved successfully.",
            attempts
        );
    } catch (error) {
        next(error);
    }
};

export const getAttemptReviewController = async (
    req,
    res,
    next
) => {
    try {
        const wrongOnly =
            req.query.wrong_only === true ||
            req.query.wrong_only === "true";

        const result =
            await getAttemptReview(
                req.user.id,
                req.params.attemptId,
                wrongOnly
            );

        return successResponse(
            res,
            200,
            "Attempt review retrieved successfully.",
            result
        );
    } catch (error) {
        next(error);
    }
};

export const markWrongReviewCompleteController =
    async (req, res, next) => {
        try {
            const result =
                await markWrongReviewComplete(
                    req.user.id,
                    req.params.attemptId
                );

            return successResponse(
                res,
                200,
                "Wrong answer review marked as complete.",
                result
            );
        } catch (error) {
            next(error);
        }
    };
