import {
    deleteManagedUser,
    deleteManagedUsers,
    getManagedUser,
    getManagedUsers,
    setManagedUserBanStatus,
    updateManagedUser,
} from "../services/adminUserService.js";

export const listManagedUsersController = async (req, res, next) => {
    try {
        const data = await getManagedUsers({
            search: req.query.search,
            plan: req.query.plan,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            page: req.query.page,
            pageSize: req.query.page_size,
        });
        return res.status(200).json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
};

export const getManagedUserController = async (req, res, next) => {
    try {
        const user = await getManagedUser(req.params.userId);
        return res.status(200).json({ success: true, user });
    } catch (error) {
        next(error);
    }
};

export const updateManagedUserController = async (req, res, next) => {
    try {
        const user = await updateManagedUser({
            targetUserId: req.params.userId,
            updates: req.body,
            adminUserId: req.user?.id,
        });
        return res.status(200).json({
            success: true,
            message: "User updated successfully.",
            user,
        });
    } catch (error) {
        next(error);
    }
};

export const banManagedUserController = async (req, res, next) => {
    try {
        const user = await setManagedUserBanStatus({
            targetUserId: req.params.userId,
            isActive: false,
            adminUserId: req.user?.id,
        });
        return res.status(200).json({
            success: true,
            message: "User has been banned.",
            user,
        });
    } catch (error) {
        next(error);
    }
};

export const unbanManagedUserController = async (req, res, next) => {
    try {
        const user = await setManagedUserBanStatus({
            targetUserId: req.params.userId,
            isActive: true,
            adminUserId: req.user?.id,
        });
        return res.status(200).json({
            success: true,
            message: "User has been unbanned.",
            user,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteManagedUserController = async (req, res, next) => {
    try {
        const data = await deleteManagedUser({
            targetUserId: req.params.userId,
            adminUserId: req.user?.id,
        });
        return res.status(200).json({
            success: true,
            message: "User and associated data deleted successfully.",
            ...data,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteManagedUsersController = async (req, res, next) => {
    try {
        const data = await deleteManagedUsers({
            targetUserIds: req.body.user_ids,
            adminUserId: req.user?.id,
        });
        return res.status(200).json({
            success: true,
            message: `${data.deleted_count} users and their associated data were deleted successfully.`,
            ...data,
        });
    } catch (error) {
        next(error);
    }
};
