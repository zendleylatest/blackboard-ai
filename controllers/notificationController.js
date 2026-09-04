import { successResponse } from "../utils/apiResponse.js";
import {
    broadcastNotification,
    registerDeviceToken,
    unregisterDeviceToken,
} from "../services/notificationService.js";

export const registerDeviceTokenController = async (req, res, next) => {
    try {
        const data = await registerDeviceToken(req.user.id, req.body);
        return successResponse(res, 200, "Device token registered successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const unregisterDeviceTokenController = async (req, res, next) => {
    try {
        const data = await unregisterDeviceToken(req.user.id, req.body.token);
        return successResponse(res, 200, "Device token unregistered successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const broadcastNotificationController = async (req, res, next) => {
    try {
        const data = await broadcastNotification(req.user, req.body);
        return successResponse(res, 200, "Notification broadcast completed.", data);
    } catch (error) {
        next(error);
    }
};
