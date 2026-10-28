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

/**
 * The user turned auto-renew off. They have already paid for the current
 * period, so tier and access stay exactly as they are until it ends (the
 * EXPIRATION event, or expires_at passing, is what revokes them).
 */
export const markSubscriptionCancelled = (userId, expiresAt = null) =>
    executeQuery(
        `
        UPDATE api_usersubscription
        SET cancellation_date = COALESCE(cancellation_date, NOW()),
            expires_at = COALESCE(?, expires_at),
            last_webhook_event = 'CANCELLATION',
            updated_at = NOW()
        WHERE user_id = ?
        `,
        [expiresAt, userId]
    );

export const upsertSubscriptionEvent = async ({
    userId,
    appUserId,
    eventType,
    tier,
    productId,
    store,
    expiresAt,
    willRenew = true,
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

    // An activation resets the cancelled flag. When the store says the
    // subscription is still running but will not renew, keep it flagged so
    // the app can show "access until <date>".
    if (isActivation && willRenew === false) {
        await executeQuery(
            "UPDATE api_usersubscription SET cancellation_date = COALESCE(cancellation_date, NOW()) WHERE user_id = ?",
            [userId]
        );
    }
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
            updated_at DATETIME(6) NOT NULL,
            owner_email VARCHAR(255) NULL,
            owner_apple_id VARCHAR(255) NULL
        )
    `).then(async () => {
        // Tables created before these columns existed.
        for (const column of ["owner_email", "owner_apple_id"]) {
            try {
                await executeQuery(
                    `ALTER TABLE api_subscriptionowner ADD COLUMN ${column} VARCHAR(255) NULL`
                );
            } catch (_) {
                // Column already exists.
            }
        }
    }).catch((error) => {
        ownerTableReady = null;
        throw error;
    });
    return ownerTableReady;
};

export const findSubscriptionOwner = async (fingerprint) => {
    const rows = await executeQuery(
        "SELECT fingerprint, user_id, expires_at, owner_email, owner_apple_id FROM api_subscriptionowner WHERE fingerprint = ? LIMIT 1",
        [fingerprint]
    );
    return rows[0] || null;
};

export const upsertSubscriptionOwner = async (fingerprint, userId, expiresAt) => {
    // Remember who the owner was: once the account row is deleted, this is
    // how the same person signing up again is recognised.
    const users = await executeQuery(
        "SELECT email, apple_user_id FROM api_user WHERE id = ? LIMIT 1",
        [userId]
    );
    const email = users[0]?.email ? String(users[0].email).toLowerCase() : null;
    const appleId = users[0]?.apple_user_id || null;
    await executeQuery(
        `
        INSERT INTO api_subscriptionowner
            (fingerprint, user_id, expires_at, updated_at, owner_email, owner_apple_id)
        VALUES (?, ?, ?, NOW(6), ?, ?)
        ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            expires_at = VALUES(expires_at),
            owner_email = VALUES(owner_email),
            owner_apple_id = VALUES(owner_apple_id),
            updated_at = NOW(6)
        `,
        [fingerprint, userId, expiresAt, email, appleId]
    );
};

/** Is this account the same person as the (deleted) owner record? */
export const isSameIdentityAsOwner = async (userId, owner) => {
    const users = await executeQuery(
        "SELECT email, apple_user_id FROM api_user WHERE id = ? LIMIT 1",
        [userId]
    );
    const user = users[0];
    if (!user) return false;
    const email = user.email ? String(user.email).toLowerCase() : null;
    return Boolean(
        (owner.owner_apple_id && user.apple_user_id &&
            owner.owner_apple_id === user.apple_user_id) ||
        (owner.owner_email && email && owner.owner_email === email)
    );
};

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
