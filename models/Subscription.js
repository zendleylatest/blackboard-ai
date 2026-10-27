import { executeQuery } from "../utils/databaseHelper.js";

export const findSubscriptionByUserId = async (userId) => {
    const rows = await executeQuery(
        `
        SELECT *
        FROM api_usersubscription
        WHERE user_id = ?
        LIMIT 1
        `,
        [userId]
    );
    return rows[0] || null;
};

export const findWebhookUser = async (appUserId) => {
    if (/^\d+$/.test(String(appUserId))) {
        const users = await executeQuery(
            "SELECT id, email FROM api_user WHERE id = ? LIMIT 1",
            [Number(appUserId)]
        );
        if (users[0]) return users[0];
    }

    const rows = await executeQuery(
        `
        SELECT u.id, u.email
        FROM api_usersubscription s
        INNER JOIN api_user u ON u.id = s.user_id
        WHERE s.revenuecat_app_user_id = ?
        LIMIT 1
        `,
        [String(appUserId)]
    );
    return rows[0] || null;
};

export const upsertSubscriptionEvent = async ({
    userId,
    appUserId,
    eventType,
    tier,
    productId,
    store,
    expiresAt,
}) => {
    const isActivation = [
        "INITIAL_PURCHASE",
        "RENEWAL",
        "PRODUCT_CHANGE",
        "UNCANCELLATION",
    ].includes(eventType);
    const isCancellation = ["CANCELLATION", "EXPIRATION"].includes(eventType);

    await executeQuery(
        `
        INSERT INTO api_usersubscription (
            tier, revenuecat_app_user_id, store, product_id,
            is_active, expires_at, original_purchase_date,
            cancellation_date, last_webhook_event,
            created_at, updated_at, user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)
        ON DUPLICATE KEY UPDATE
            tier = CASE
                WHEN ? THEN VALUES(tier)
                WHEN ? THEN 'free'
                ELSE tier
            END,
            revenuecat_app_user_id = CASE WHEN ? THEN VALUES(revenuecat_app_user_id) ELSE revenuecat_app_user_id END,
            store = CASE WHEN ? THEN VALUES(store) ELSE store END,
            product_id = CASE WHEN ? THEN VALUES(product_id) ELSE product_id END,
            is_active = CASE WHEN ? THEN 1 WHEN ? THEN 0 ELSE is_active END,
            expires_at = CASE WHEN ? THEN VALUES(expires_at) ELSE expires_at END,
            original_purchase_date = CASE
                WHEN ? AND original_purchase_date IS NULL THEN NOW()
                ELSE original_purchase_date
            END,
            cancellation_date = CASE
                WHEN ? THEN NULL
                WHEN ? THEN NOW()
                ELSE cancellation_date
            END,
            last_webhook_event = VALUES(last_webhook_event),
            updated_at = NOW()
        `,
        [
            isActivation ? tier : "free",
            String(appUserId),
            store,
            productId || null,
            isActivation ? 1 : 0,
            expiresAt,
            eventType === "INITIAL_PURCHASE" ? new Date() : null,
            isCancellation ? new Date() : null,
            eventType,
            userId,
            isActivation,
            isCancellation,
            isActivation,
            isActivation,
            isActivation,
            isActivation,
            isCancellation,
            isActivation,
            eventType === "INITIAL_PURCHASE",
            isActivation,
            isCancellation,
        ]
    );
};

/*
|--------------------------------------------------------------------------
| Store-subscription ownership
|--------------------------------------------------------------------------
| An Apple/Google subscription belongs to the store account, not to a Blackboard
| AI account. RevenueCat will happily "transfer" it to whichever app account
| restores last, so the server records which app account first claimed each
| subscription and refuses to hand a still-valid one to a second account.
| The key ("fingerprint") is product + original purchase time, which is the same
| for every app account that sees that one underlying subscription.
*/

let ownerTableReady = null;

export const ensureOwnerTable = () => {
    ownerTableReady ??= executeQuery(`
        CREATE TABLE IF NOT EXISTS api_subscriptionowner (
            fingerprint VARCHAR(190) NOT NULL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            expires_at DATETIME(6) NULL,
            updated_at DATETIME(6) NOT NULL
        )
    `).catch((error) => {
        ownerTableReady = null;
        throw error;
    });
    return ownerTableReady;
};

export const findSubscriptionOwner = async (fingerprint) => {
    const rows = await executeQuery(
        "SELECT fingerprint, user_id, expires_at FROM api_subscriptionowner WHERE fingerprint = ? LIMIT 1",
        [fingerprint]
    );
    return rows[0] || null;
};

export const upsertSubscriptionOwner = (fingerprint, userId, expiresAt) =>
    executeQuery(
        `
        INSERT INTO api_subscriptionowner (fingerprint, user_id, expires_at, updated_at)
        VALUES (?, ?, ?, NOW(6))
        ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            expires_at = VALUES(expires_at),
            updated_at = NOW(6)
        `,
        [fingerprint, userId, expiresAt]
    );

/** Does an account with this id still exist? */
export const userAccountExists = async (userId) => {
    const rows = await executeQuery(
        "SELECT 1 FROM api_user WHERE id = ? LIMIT 1",
        [userId]
    );
    return rows.length > 0;
};

/**
 * Keep an orphaned subscription (its owner's account was deleted) locked: its
 * stored expiry follows the real one, so a later account cannot claim it just
 * because the old expiry date passed while the store keeps renewing it.
 */
export const extendOwnerExpiry = (fingerprint, expiresAt) =>
    executeQuery(
        `
        UPDATE api_subscriptionowner
        SET expires_at = ?, updated_at = NOW(6)
        WHERE fingerprint = ? AND (expires_at IS NULL OR expires_at < ?)
        `,
        [expiresAt, fingerprint, expiresAt]
    );

/** Does this user still own a store subscription that hasn't expired? */
export const userOwnsLiveSubscription = async (userId) => {
    const rows = await executeQuery(
        `
        SELECT 1 FROM api_subscriptionowner
        WHERE user_id = ? AND expires_at IS NOT NULL AND expires_at > NOW(6)
        LIMIT 1
        `,
        [userId]
    );
    return rows.length > 0;
};

/** Mark an account as "tried to use a subscription owned by another account". */
export const markSubscriptionBlocked = (userId) =>
    executeQuery(
        `
        INSERT INTO api_usersubscription (
            tier, revenuecat_app_user_id, store, product_id,
            is_active, expires_at, original_purchase_date,
            cancellation_date, last_webhook_event,
            created_at, updated_at, user_id
        )
        VALUES ('free', ?, 'app_store', NULL, 0, NULL, NULL, NULL,
                'BLOCKED_OTHER_ACCOUNT', NOW(), NOW(), ?)
        ON DUPLICATE KEY UPDATE
            tier = 'free', is_active = 0,
            last_webhook_event = 'BLOCKED_OTHER_ACCOUNT',
            updated_at = NOW()
        `,
        [String(userId), userId]
    );
