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

    console.info(
        `[SUBSCRIPTION] webhook ${event.type} app_user_id=${event.app_user_id} product=${event.product_id} new_product=${event.new_product_id || ""} store=${event.store}`
    );
    const user = await findWebhookUser(event.app_user_id);
    if (!user) {
        console.warn(`[SUBSCRIPTION] webhook user not found for app_user_id=${event.app_user_id}`);
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

/**
 * Pull the user's real subscription state straight from RevenueCat and store
 * it. The webhook is the normal path, but it can lag, arrive out of order
 * (an upgrade's events) or never arrive (misconfigured URL), leaving the
 * server - and therefore the usage limits - on the old plan. The app calls
 * this right after a purchase/upgrade so limits follow immediately.
 *
 * Needs REVENUECAT_SECRET_API_KEY (RevenueCat > Project settings > API keys >
 * secret key). Without it this is a no-op and the webhook stays the source.
 */
export const syncSubscriptionFromRevenueCat = async (userId) => {
    const secret = process.env.REVENUECAT_SECRET_API_KEY || "";
    if (!secret) {
        console.warn(
            "[SUBSCRIPTION] sync skipped: REVENUECAT_SECRET_API_KEY is not set, so plans only update via the RevenueCat webhook."
        );
        return { status: "not_configured" };
    }

    // Never overwrite a still-valid manual admin grant.
    const current = await findSubscriptionByUserId(userId);
    if (
        current?.store === "promotional" &&
        current.is_active &&
        (!current.expires_at || new Date(current.expires_at) > new Date())
    ) {
        return { status: "manual_grant" };
    }

    const response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(String(userId))}`,
        { headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" } }
    );
    if (!response.ok) {
        throw new HttpError(502, "Could not reach the subscription service.");
    }
    const payload = await response.json();
    const subscriptions = payload?.subscriber?.subscriptions || {};

    // Highest active tier wins (an upgrade can briefly leave both active).
    let best = null;
    for (const [productId, info] of Object.entries(subscriptions)) {
        const expires = info?.expires_date ? new Date(info.expires_date) : null;
        if (expires && expires <= new Date()) continue;
        const tier = resolveTier(productId);
        if (tier === "free") continue;
        const rank = tier === "pro" ? 2 : 1;
        if (!best || rank > best.rank) {
            best = {
                rank,
                tier,
                productId,
                expires,
                store: /APP_STORE|APPLE/i.test(String(info?.store || ""))
                    ? "app_store"
                    : "play_store",
                willRenew: !info?.unsubscribe_detected_at,
            };
        }
    }

    console.info(
        `[SUBSCRIPTION] sync user=${userId} -> ${best?.tier || "free"} (${best?.productId || "none"})`
    );
    await upsertSubscriptionEvent({
        userId,
        appUserId: String(userId),
        eventType: best ? "RENEWAL" : "EXPIRATION",
        tier: best?.tier || "free",
        productId: best?.productId || current?.product_id || null,
        store: best?.store || current?.store || "app_store",
        expiresAt: best?.expires || null,
    });
    return { status: "synced", tier: best?.tier || "free" };
};
