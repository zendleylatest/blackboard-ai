import { executeQuery } from "../utils/databaseHelper.js";

export const findManagedUsers = async ({ search, limit, offset }) => {
    const normalizedSearch = String(search || "").trim().toLowerCase();
    const searchPattern = `%${normalizedSearch}%`;
    const where = normalizedSearch
        ? `WHERE LOWER(u.email) LIKE ?
             OR LOWER(u.username) LIKE ?
             OR LOWER(COALESCE(p.full_name, '')) LIKE ?`
        : "";
    const params = normalizedSearch
        ? [searchPattern, searchPattern, searchPattern]
        : [];

    return executeQuery(
        `
        SELECT
            u.id,
            u.username,
            u.email,
            u.role,
            u.auth_provider,
            u.is_verified,
            u.is_active,
            u.profile_completed,
            u.created_at,
            u.last_login,
            p.full_name,
            p.age,
            p.class_level,
            p.exam_board
        FROM api_user u
        LEFT JOIN api_userprofile p ON p.user_id = u.id
        ${where}
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        params
    );
};

export const countManagedUsers = async (search) => {
    const normalizedSearch = String(search || "").trim().toLowerCase();
    const searchPattern = `%${normalizedSearch}%`;
    const where = normalizedSearch
        ? `WHERE LOWER(u.email) LIKE ?
             OR LOWER(u.username) LIKE ?
             OR LOWER(COALESCE(p.full_name, '')) LIKE ?`
        : "";
    const params = normalizedSearch
        ? [searchPattern, searchPattern, searchPattern]
        : [];
    const rows = await executeQuery(
        `
        SELECT COUNT(*) AS count
        FROM api_user u
        LEFT JOIN api_userprofile p ON p.user_id = u.id
        ${where}
        `,
        params
    );
    return Number(rows[0]?.count || 0);
};

export const findManagedUserById = async (userId, connection = null) => {
    const rows = await executeQuery(
        `
        SELECT
            u.id,
            u.username,
            u.email,
            u.role,
            u.auth_provider,
            u.is_verified,
            u.is_active,
            u.profile_completed,
            u.created_at,
            u.last_login,
            p.full_name,
            p.age,
            p.class_level,
            p.exam_board,
            p.profile_pic_url,
            s.tier AS subscription_tier,
            s.store AS subscription_store,
            s.product_id AS subscription_product_id,
            s.is_active AS subscription_is_active,
            s.expires_at AS subscription_expires_at,
            s.original_purchase_date AS subscription_started_at,
            s.updated_at AS subscription_updated_at
        FROM api_user u
        LEFT JOIN api_userprofile p ON p.user_id = u.id
        LEFT JOIN api_usersubscription s ON s.user_id = u.id
        WHERE u.id = ?
        LIMIT 1
        `,
        [userId],
        connection
    );
    return rows[0] || null;
};
