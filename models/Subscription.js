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
