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

    // A grant/subscription past its expiry no longer counts, even if nothing
    // has flipped is_active yet (manual admin grants have no webhook to do so).
    const expired = subscription.expires_at &&
        new Date(subscription.expires_at) <= new Date();
    const active = Boolean(subscription.is_active) && !expired;

    return {
        tier: active ? subscription.tier : "free",
        is_active: active,
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

    // A store subscription can outlive the account that bought it. If this
    // event is for a different app user than the one the purchase originally
    // belonged to, and that original account no longer exists (deleted), the
    // new account must NOT inherit the premium access.
    const originalId = String(event.original_app_user_id || "");
    if (
        /^\d+$/.test(originalId) &&
        originalId !== String(event.app_user_id) &&
        ["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"].includes(eventType)
    ) {
        const originalUser = await findWebhookUser(originalId);
        if (!originalUser) {
            return { status: "ok", warning: "purchase_belongs_to_deleted_account" };
        }
    }

    // A manual admin grant ("promotional") is not a store purchase, so
    // RevenueCat knows nothing about it. Its cancellation/expiration/billing
    // events (e.g. for an old or transferred store purchase) must not wipe out
    // a grant that is still valid. Real purchase events still take over.
    if (["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"].includes(eventType)) {
        const current = await findSubscriptionByUserId(user.id);
        const grantStillValid = current &&
            current.store === "promotional" &&
            current.is_active &&
            (!current.expires_at || new Date(current.expires_at) > new Date());
        if (grantStillValid) {
            return { status: "ok", warning: "manual_grant_preserved" };
        }
    }

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
            // For PRODUCT_CHANGE, product_id is the OLD product and
            // new_product_id the one switched to; using product_id kept
            // upgrades/downgrades on the previous tier.
            tier: resolveTier(
                eventType === "PRODUCT_CHANGE" && event.new_product_id
                    ? event.new_product_id
                    : event.product_id
            ),
            productId: eventType === "PRODUCT_CHANGE" && event.new_product_id
                ? event.new_product_id
                : event.product_id,
            // RevenueCat sends "APP_STORE" / "MAC_APP_STORE" for Apple, which
            // the old check (looking for "APPLE") mislabelled as play_store.
            store: /APP_STORE|APPLE/i.test(String(event.store || ""))
                ? "app_store"
                : "play_store",
            expiresAt: event.expiration_at_ms
                ? new Date(Number(event.expiration_at_ms))
                : null,
        });
    }

    return { status: "ok" };
};
