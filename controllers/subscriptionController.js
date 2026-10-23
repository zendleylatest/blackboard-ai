import { successResponse } from "../utils/apiResponse.js";
import {
    getSubscriptionStatus,
    processRevenueCatWebhook,
    syncSubscriptionFromRevenueCat,
} from "../services/subscriptionService.js";

export const getSubscriptionStatusController = async (req, res, next) => {
    try {
        const data = await getSubscriptionStatus(req.user.id);
        return successResponse(res, 200, "Subscription status retrieved successfully.", data);
    } catch (error) {
        next(error);
    }
};

export const revenueCatWebhookController = async (req, res, next) => {
    try {
        const data = await processRevenueCatWebhook(
            req.get("Authorization"),
            req.body
        );
        return successResponse(res, 200, "RevenueCat event processed.", data);
    } catch (error) {
        next(error);
    }
};

export const syncSubscriptionController = async (req, res, next) => {
    try {
        await syncSubscriptionFromRevenueCat(req.user.id);
        const data = await getSubscriptionStatus(req.user.id);
        return successResponse(res, 200, "Subscription synced.", data);
    } catch (error) {
        next(error);
    }
};
