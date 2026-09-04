import { executeQuery } from "../utils/databaseHelper.js";

export const registerToken = async ({
    userId,
    token,
    platform,
}) => {
    const currentRows = await executeQuery(
        "SELECT user_id FROM api_devicetoken WHERE token = ? LIMIT 1",
        [token]
    );
    const created = currentRows.length === 0;

    await executeQuery(
        `
        INSERT INTO api_devicetoken (
            token, platform, is_active, created_at, updated_at, user_id
        )
        VALUES (?, ?, 1, NOW(), NOW(), ?)
        ON DUPLICATE KEY UPDATE
            platform = VALUES(platform),
            is_active = 1,
            updated_at = NOW(),
            user_id = VALUES(user_id)
        `,
        [token, platform, userId]
    );

    return created;
};

export const unregisterToken = async (userId, token) => executeQuery(
    `
    UPDATE api_devicetoken
    SET is_active = 0, updated_at = NOW()
    WHERE user_id = ? AND token = ?
    `,
    [userId, token]
);

export const findBroadcastTokens = async (tier) => {
    const params = [];
    let clause = "";

    if (tier === "free") {
        clause = `
            AND NOT EXISTS (
                SELECT 1
                FROM api_usersubscription s
                WHERE s.user_id = d.user_id
                  AND s.is_active = 1
                  AND s.tier <> 'free'
            )
        `;
    } else if (["plus", "pro"].includes(tier)) {
        clause = `
            AND EXISTS (
                SELECT 1
                FROM api_usersubscription s
                WHERE s.user_id = d.user_id
                  AND s.is_active = 1
                  AND s.tier = ?
            )
        `;
        params.push(tier);
    }

    return executeQuery(
        `
        SELECT token
        FROM api_devicetoken d
        WHERE d.is_active = 1
        ${clause}
        `,
        params
    );
};

export const deactivateTokens = async (tokens) => {
    if (tokens.length === 0) return;
    await executeQuery(
        `
        UPDATE api_devicetoken
        SET is_active = 0, updated_at = NOW()
        WHERE token IN (${tokens.map(() => "?").join(", ")})
        `,
        tokens
    );
};
