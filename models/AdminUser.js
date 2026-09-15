import { executeQuery } from "../utils/databaseHelper.js";

const PREMIUM_TIERS = ["plus", "pro"];

// Matches the "is this subscription actually active" logic used when
// serializing a single managed user (adminUserService.js's
// serializeManagedUser), so filtering by plan agrees with what the
// dashboard displays as each user's current plan.
const EFFECTIVE_PLAN_SQL = `
    CASE
        WHEN s.is_active = 1
            AND LOWER(COALESCE(s.tier, '')) IN (${PREMIUM_TIERS.map((tier) => `'${tier}'`).join(", ")})
            AND (s.expires_at IS NULL OR s.expires_at > NOW())
        THEN LOWER(s.tier)
        ELSE 'free'
    END
`;

const buildFilters = ({ search, plan, startDate, endDate }) => {
    const clauses = [];
    const params = [];

    const normalizedSearch = String(search || "").trim().toLowerCase();
    if (normalizedSearch) {
        const searchPattern = `%${normalizedSearch}%`;
        clauses.push(`(
            LOWER(u.email) LIKE ?
            OR LOWER(u.username) LIKE ?
            OR LOWER(COALESCE(p.full_name, '')) LIKE ?
        )`);
        params.push(searchPattern, searchPattern, searchPattern);
    }

    const normalizedPlan = String(plan || "").trim().toLowerCase();
    if (normalizedPlan && normalizedPlan !== "all") {
        clauses.push(`${EFFECTIVE_PLAN_SQL} = ?`);
        params.push(normalizedPlan);
    }

    if (startDate) {
        clauses.push("u.created_at >= ?");
        params.push(startDate);
    }
    if (endDate) {
        clauses.push("u.created_at <= ?");
        params.push(endDate);
    }

    return {
        where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
        params,
    };
};

export const findManagedUsers = async ({
    search,
    plan,
    startDate,
    endDate,
    limit,
    offset,
}) => {
    const { where, params } = buildFilters({ search, plan, startDate, endDate });

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
            p.exam_board,
            s.tier AS subscription_tier,
            s.is_active AS subscription_is_active,
            s.expires_at AS subscription_expires_at,
            ${EFFECTIVE_PLAN_SQL} AS effective_plan
        FROM api_user u
        LEFT JOIN api_userprofile p ON p.user_id = u.id
        LEFT JOIN api_usersubscription s ON s.user_id = u.id
        ${where}
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        params
    );
};

export const countManagedUsers = async ({ search, plan, startDate, endDate } = {}) => {
    const { where, params } = buildFilters({ search, plan, startDate, endDate });
    const rows = await executeQuery(
        `
        SELECT COUNT(*) AS count
        FROM api_user u
        LEFT JOIN api_userprofile p ON p.user_id = u.id
        LEFT JOIN api_usersubscription s ON s.user_id = u.id
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

export const setUserActiveStatus = async (userId, isActive, connection = null) => {
    await executeQuery(
        `UPDATE api_user SET is_active = ? WHERE id = ?`,
        [isActive ? 1 : 0, userId],
        connection
    );
};
