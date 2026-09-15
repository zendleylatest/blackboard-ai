import { executeQuery } from "../utils/databaseHelper.js";

/*
|--------------------------------------------------------------------------
| INSERT
|--------------------------------------------------------------------------
*/

export const insertAiUsageLog = async ({
    userId,
    feature,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd,
}) => {

    const sql = `
        INSERT INTO api_aiusagelog
        (
            user_id,
            feature,
            model,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            estimated_cost_usd,
            created_at
        )
        VALUES
        (
            ?, ?, ?, ?, ?, ?, ?, NOW()
        )
    `;

    await executeQuery(
        sql,
        [
            userId,
            feature,
            model,
            promptTokens ?? 0,
            completionTokens ?? 0,
            totalTokens ?? 0,
            estimatedCostUsd ?? 0,
        ]
    );

};

/*
|--------------------------------------------------------------------------
| AGGREGATE QUERIES
|--------------------------------------------------------------------------
*/

// Per-user lifetime totals, keyed by user_id, for the given set of user IDs.
export const findAiUsageTotalsByUserIds = async (userIds) => {

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return {};
    }

    const placeholders = userIds.map(() => "?").join(", ");

    const sql = `
        SELECT
            user_id,
            SUM(total_tokens) AS total_tokens,
            SUM(estimated_cost_usd) AS estimated_cost_usd
        FROM api_aiusagelog
        WHERE user_id IN (${placeholders})
        GROUP BY user_id
    `;

    const rows = await executeQuery(sql, userIds);

    const totalsByUserId = {};
    for (const row of rows) {
        totalsByUserId[Number(row.user_id)] = {
            total_tokens: Number(row.total_tokens) || 0,
            estimated_cost_usd: Number(row.estimated_cost_usd) || 0,
        };
    }
    return totalsByUserId;

};

export const findAiUsageTotalForUser = async (userId) => {

    const sql = `
        SELECT
            SUM(total_tokens) AS total_tokens,
            SUM(estimated_cost_usd) AS estimated_cost_usd,
            COUNT(*) AS request_count
        FROM api_aiusagelog
        WHERE user_id = ?
    `;

    const rows = await executeQuery(sql, [userId]);
    const row = rows[0] || {};

    return {
        total_tokens: Number(row.total_tokens) || 0,
        estimated_cost_usd: Number(row.estimated_cost_usd) || 0,
        request_count: Number(row.request_count) || 0,
    };

};
