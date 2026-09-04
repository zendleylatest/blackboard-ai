import {
    listUserChatThreads,
    createUserChatThread,
    deleteUserChatThread,
    generateAndSaveChatTitle,
    getUserThreadMessages,
} from "../services/chatThreadService.js";

export const listChatThreadsController = async (
    req,
    res,
    next
) => {
    try {
        const userId = req.user.id;

        const subjectId =
            req.query.subject_id || null;

        const threads =
            await listUserChatThreads(
                userId,
                subjectId
            );

        return res.status(200).json(
            threads
        );
    } catch (error) {
        return next(error);
    }
};

export const createChatThreadController = async (
    req,
    res,
    next
) => {
    try {
        const userId = req.user.id;

        const subjectId =
            req.body.subject_id || null;

        const title =
            req.body.title || "";

        const thread =
            await createUserChatThread(
                userId,
                subjectId,
                title
            );

        return res.status(201).json(
            thread
        );
    } catch (error) {
        return next(error);
    }
};

export const deleteChatThreadController = async (
    req,
    res,
    next
) => {
    try {
        const userId = req.user.id;

        const threadId =
            req.params.thread_id;

        const result =
            await deleteUserChatThread(
                userId,
                threadId
            );

        return res.status(200).json(
            result
        );
    } catch (error) {
        return next(error);
    }
};

export const generateChatTitleController = async (
    req,
    res,
    next
) => {
    try {
        const userId = req.user.id;

        const threadId =
            req.params.thread_id;

        const firstMessage =
            req.body.first_message;

        const subjectCode =
            req.body.subject_code || "";

        const result =
            await generateAndSaveChatTitle(
                userId,
                threadId,
                firstMessage,
                subjectCode
            );

        return res.status(200).json(
            result
        );
    } catch (error) {
        return next(error);
    }
};

export const getThreadMessagesController = async (
    req,
    res,
    next
) => {
    try {
        const userId = req.user.id;

        const threadId =
            req.params.thread_id;

        const messages =
            await getUserThreadMessages(
                userId,
                threadId
            );

        return res.status(200).json(
            messages
        );
    } catch (error) {
        return next(error);
    }
};
