import HttpError from "../utils/httpError.js";
import {
    findSubscriptionByUserId,
    findWebhookUser,
    upsertSubscriptionEvent,
} from "../models/Subscription.js";

const PRODUCT_TIERS = {
    blackboard_ai_plus_monthly: "plus",
    blackboard_ai_pro_monthly: "pro",
    "blackboard_ai_plus_monthly:plus-monthly-base": "plus",
    "blackboard_ai_pro_monthly:pro-monthly-base": "pro",
};

const resolveTier = (productId) => {
    const normalized = String(productId || "").toLowerCase().trim();
    return PRODUCT_TIERS[normalized] ||
        PRODUCT_TIERS[normalized.split(":")[0]] ||
        (normalized.includes("pro")
            ? "pro"
            : normalized.includes("plus")
                ? "plus"
                : "free");
};

export const getSubscriptionStatus = async (userId) => {
    const subscription = await findSubscriptionByUserId(userId);
    if (!subscription) {
        return {
            tier: "free",
            is_active: false,
            product_id: null,
            store: null,
            expires_at: null,
        };
    }

    return {
        tier: subscription.is_active ? subscription.tier : "free",
        is_active: Boolean(subscription.is_active),
        product_id: subscription.product_id,
        store: subscription.store,
        expires_at: subscription.expires_at
            ? new Date(subscription.expires_at).toISOString()
            : null,
    };
};

export const processRevenueCatWebhook = async (authorization, payload) => {
    const expectedKey = process.env.REVENUECAT_WEBHOOK_AUTH_KEY || "";
    if (
        !expectedKey ||
        ![expectedKey, `Bearer ${expectedKey}`].includes(authorization || "")
    ) {
        throw new HttpError(401, "Unauthorized");
    }

    const event = payload?.event;
    if (!event || typeof event !== "object") {
        throw new HttpError(400, "Invalid RevenueCat event.");
    }
    if (event.type === "TEST") return { status: "ok" };

    const user = await findWebhookUser(event.app_user_id);
    if (!user) {
        return {
            status: "ok",
            warning: "user_not_found",
        };
    }

    const eventType = String(event.type || "");
    if ([
        "INITIAL_PURCHASE",
        "RENEWAL",
        "PRODUCT_CHANGE",
        "UNCANCELLATION",
        "CANCELLATION",
        "EXPIRATION",
        "BILLING_ISSUE",
    ].includes(eventType)) {
        await upsertSubscriptionEvent({
            userId: user.id,
            appUserId: event.app_user_id,
            eventType,
            tier: resolveTier(event.product_id),
            productId: event.product_id,
            store: String(event.store || "").toUpperCase().includes("APPLE")
                ? "app_store"
                : "play_store",
            expiresAt: event.expiration_at_ms
                ? new Date(Number(event.expiration_at_ms))
                : null,
        });
    }

    return { status: "ok" };
};
