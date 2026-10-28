import HttpError from "../utils/httpError.js";
import {
    ensureOwnerTable,
    findSubscriptionByUserId,
    findSubscriptionOwner,
    userAccountExists,
    isSameIdentityAsOwner,
    markSubscriptionCancelled,
    extendOwnerExpiry,
    findWebhookUser,
    markSubscriptionBlocked,
    upsertSubscriptionEvent,
    upsertSubscriptionOwner,
    userOwnsLiveSubscription,
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

const isStoreSubscriptionEvent = (type) => [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "PRODUCT_CHANGE",
    "UNCANCELLATION",
    "CANCELLATION",
    "EXPIRATION",
    "BILLING_ISSUE",
].includes(type);

/** All subscriptions RevenueCat has for an app user, or null if unavailable. */
const fetchRevenueCatSubscriptions = async (appUserId) => {
    const secret = process.env.REVENUECAT_SECRET_API_KEY || "";
    if (!secret) return null;
    const response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(String(appUserId))}`,
        { headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" } }
    );
    if (!response.ok) {
        throw new HttpError(502, "Could not reach the subscription service.");
    }
    const payload = await response.json();
    return payload?.subscriber?.subscriptions || {};
};

/**
 * Identifies one underlying store subscription, independent of which app
 * account RevenueCat currently attaches it to.
 */
const fingerprintFor = (productId, info) => {
    const originalPurchase = info?.original_purchase_date
        ? new Date(info.original_purchase_date).getTime()
        : null;
    return originalPurchase ? `${productId}|${originalPurchase}` : null;
};

/**
 * Which app account owns this store subscription? The first account to claim
 * it keeps it for as long as it is valid (a second account restoring the same
 * Apple/Google subscription does not take it over). Once it has expired, or
 * the owner's account no longer exists, anyone may claim it.
 */
// Returned by resolveSubscriptionOwner when the owning account was deleted.
export const ORPHANED_OWNER = -1;

export const resolveSubscriptionOwner = async (userId, fingerprint, expiresAt) => {
    await ensureOwnerTable();
    const owner = await findSubscriptionOwner(fingerprint);
    const ownerId = owner ? Number(owner.user_id) : null;

    if (!owner || ownerId === Number(userId)) {
        await upsertSubscriptionOwner(fingerprint, userId, expiresAt);
        return Number(userId);
    }
    const ownerStillLive =
        owner.expires_at && new Date(owner.expires_at) > new Date();
    if (ownerStillLive) {
        if (await userAccountExists(ownerId)) return ownerId;
        // The owner deleted their account, but the Apple/Google subscription
        // is still running on that store account. It must NOT pass to just
        // anyone who signs up next on the same device, but the same person
        // (same Apple ID / email) re-creating their account gets it back.
        if (await isSameIdentityAsOwner(userId, owner)) {
            await upsertSubscriptionOwner(fingerprint, userId, expiresAt);
            return Number(userId);
        }
        if (expiresAt && new Date(expiresAt) > new Date(owner.expires_at)) {
            await extendOwnerExpiry(fingerprint, expiresAt);
        }
        return ORPHANED_OWNER;
    }

    await upsertSubscriptionOwner(fingerprint, userId, expiresAt);
    return Number(userId);
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
        // True when this account tried to use a store subscription that is
        // already linked to a different Blackboard AI account.
        blocked: subscription.last_webhook_event === "BLOCKED_OTHER_ACCOUNT",
        // False once the user cancelled: access continues until expires_at.
        will_renew: active ? !subscription.cancellation_date : false,
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

    // The store subscription belongs to ONE app account. RevenueCat may attach
    // it to whichever account restored last, so work out the real owner and
    // apply the event to that account instead (the other one stays Free).
    let target = user;
    if (isStoreSubscriptionEvent(eventType) && process.env.REVENUECAT_SECRET_API_KEY) {
        try {
            const productId = eventType === "PRODUCT_CHANGE" && event.new_product_id
                ? event.new_product_id
                : event.product_id;
            const subscriptions = await fetchRevenueCatSubscriptions(event.app_user_id);
            const info = subscriptions?.[productId];
            const fingerprint = fingerprintFor(productId, info);
            if (fingerprint) {
                const expires = info?.expires_date ? new Date(info.expires_date) : null;
                const ownerId = await resolveSubscriptionOwner(user.id, fingerprint, expires);
                if (ownerId === ORPHANED_OWNER) {
                    console.warn(
                        `[SUBSCRIPTION] ${eventType} for user ${user.id} ignored: the subscription belongs to a deleted account`
                    );
                    const mine = await findSubscriptionByUserId(user.id);
                    if (!(mine?.store === "promotional" && mine.is_active)) {
                        await markSubscriptionBlocked(user.id);
                    }
                    return { status: "ok", warning: "purchase_belongs_to_deleted_account" };
                }
                if (ownerId !== Number(user.id)) {
                    console.warn(
                        `[SUBSCRIPTION] ${eventType} for user ${user.id} belongs to account ${ownerId}; applying it there`
                    );
                    if (["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"].includes(eventType)) {
                        const mine = await findSubscriptionByUserId(user.id);
                        const hasOwnGrant = mine?.store === "promotional" && mine.is_active;
                        if (!hasOwnGrant) await markSubscriptionBlocked(user.id);
                    }
                    target = { id: ownerId, email: "" };
                }
            }
        } catch (error) {
            // Fail open: if ownership can't be checked, behave as before.
            console.warn(`[SUBSCRIPTION] ownership check skipped: ${error.message}`);
        }
    }

    // A manual admin grant ("promotional") is not a store purchase, so
    // RevenueCat knows nothing about it. Its cancellation/expiration/billing
    // events (e.g. for an old or transferred store purchase) must not wipe out
    // a grant that is still valid. Real purchase events still take over.
    if (["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"].includes(eventType)) {
        const current = await findSubscriptionByUserId(target.id);
        const grantStillValid = current &&
            current.store === "promotional" &&
            current.is_active &&
            (!current.expires_at || new Date(current.expires_at) > new Date());
        if (grantStillValid) {
            return { status: "ok", warning: "manual_grant_preserved" };
        }
    }

    const tierRank = (tier) => ({ free: 0, plus: 1, pro: 2 }[tier] || 0);

    // CANCELLATION means "auto-renew was turned off" - the customer has paid
    // for the current period and keeps full access until it ends (EXPIRATION
    // is the event that ends it). Only a refund revokes access immediately.
    if (eventType === "CANCELLATION") {
        const current = await findSubscriptionByUserId(target.id);
        const refunded = String(event.cancel_reason || "").toUpperCase() === "CUSTOMER_SUPPORT";
        const periodEnd = event.expiration_at_ms
            ? new Date(Number(event.expiration_at_ms))
            : (current?.expires_at ? new Date(current.expires_at) : null);
        if (current && !refunded && periodEnd && periodEnd > new Date()) {
            await markSubscriptionCancelled(target.id, periodEnd);
            console.info(`[SUBSCRIPTION] user ${target.id} cancelled; access kept until ${periodEnd.toISOString()}`);
            return { status: "ok", warning: "cancelled_access_kept_until_period_end" };
        }
    }

    // A downgrade (e.g. Pro -> Plus) only takes effect when the period the
    // customer already paid for ends. Until then they keep the higher plan; the
    // store sends the renewal for the new plan at that point.
    if (eventType === "PRODUCT_CHANGE" && event.new_product_id) {
        const current = await findSubscriptionByUserId(target.id);
        const newTier = resolveTier(event.new_product_id);
        if (
            current?.is_active &&
            current.expires_at &&
            new Date(current.expires_at) > new Date() &&
            tierRank(newTier) < tierRank(String(current.tier || "free").toLowerCase())
        ) {
            console.info(
                `[SUBSCRIPTION] user ${target.id}: downgrade to ${newTier} deferred until ${new Date(current.expires_at).toISOString()}`
            );
            return { status: "ok", warning: "downgrade_deferred_until_period_end" };
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
            userId: target.id,
            appUserId: String(target.id === user.id ? event.app_user_id : target.id),
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

    const subscriptions = await fetchRevenueCatSubscriptions(userId);

    // Highest active tier wins (an upgrade can briefly leave both active),
    // but only among subscriptions this account actually owns.
    let best = null;
    let blockedByOther = false;
    for (const [productId, info] of Object.entries(subscriptions || {})) {
        const expires = info?.expires_date ? new Date(info.expires_date) : null;
        if (expires && expires <= new Date()) continue;
        const tier = resolveTier(productId);
        if (tier === "free") continue;

        const fingerprint = fingerprintFor(productId, info);
        if (fingerprint) {
            const ownerId = await resolveSubscriptionOwner(userId, fingerprint, expires);
            if (ownerId !== Number(userId)) {
                blockedByOther = true;
                continue;
            }
        }

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

    if (!best && blockedByOther) {
        // Another account owns this Apple/Google subscription: stay Free.
        await markSubscriptionBlocked(userId);
        console.info(`[SUBSCRIPTION] sync user=${userId} blocked: subscription belongs to another account`);
        return { status: "owned_by_other_account", tier: "free" };
    }

    if (!best && (await userOwnsLiveSubscription(userId))) {
        // RevenueCat has moved the subscription to another account (e.g. after
        // a restore there), but it is still valid and still ours: keep it.
        console.info(`[SUBSCRIPTION] sync user=${userId}: keeping owned subscription despite RevenueCat transfer`);
        return { status: "kept_owned", tier: (await findSubscriptionByUserId(userId))?.tier || "free" };
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
        willRenew: best ? best.willRenew : true,
    });
    return { status: "synced", tier: best?.tier || "free" };
};
