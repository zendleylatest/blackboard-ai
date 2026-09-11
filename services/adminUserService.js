import pool from "../config/database.js";
import {
    countManagedUsers,
    findManagedUserById,
    findManagedUsers,
} from "../models/AdminUser.js";
import { findUserByIdSafe } from "../models/auth/User.js";
import HttpError from "../utils/httpError.js";
import { deleteDependentRows } from "../utils/cascadeDelete.js";

const ADMIN_ROLES = new Set(["admin", "staff", "superadmin"]);
const PREMIUM_TIERS = new Set(["plus", "pro"]);

const deletePendingRegistrationForUser = async (connection, user) => {
    await connection.execute(
        `DELETE FROM api_pendinguser
         WHERE LOWER(email) = LOWER(?)
            OR LOWER(username) = LOWER(?)`,
        [user.email, user.username]
    );
};

export const getManagedUsers = async ({ search, page = 1, pageSize = 20 }) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const offset = (safePage - 1) * safePageSize;
    const [users, totalCount] = await Promise.all([
        findManagedUsers({ search, limit: safePageSize, offset }),
        countManagedUsers(search),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));

    return {
        users: users.map((user) => ({
            ...user,
            id: Number(user.id),
            is_verified: Boolean(user.is_verified),
            is_active: Boolean(user.is_active),
            profile_completed: Boolean(user.profile_completed),
        })),
        pagination: {
            page: safePage,
            page_size: safePageSize,
            total_count: totalCount,
            total_pages: totalPages,
            has_next: safePage < totalPages,
            has_prev: safePage > 1,
        },
    };
};

const serializeManagedUser = (user) => {
    const expiresAt = user.subscription_expires_at
        ? new Date(user.subscription_expires_at)
        : null;
    const subscriptionActive = Boolean(user.subscription_is_active) &&
        PREMIUM_TIERS.has(String(user.subscription_tier || "").toLowerCase()) &&
        (!expiresAt || expiresAt > new Date());

    return {
        id: Number(user.id),
        username: user.username,
        email: user.email,
        role: user.role,
        auth_provider: user.auth_provider,
        is_verified: Boolean(user.is_verified),
        is_active: Boolean(user.is_active),
        profile_completed: Boolean(user.profile_completed),
        created_at: user.created_at,
        last_login: user.last_login,
        profile: {
            full_name: user.full_name || "",
            age: user.age === null || user.age === undefined ? null : Number(user.age),
            class_level: user.class_level || "",
            exam_board: user.exam_board || "",
            profile_pic_url: user.profile_pic_url || null,
        },
        subscription: {
            tier: subscriptionActive ? String(user.subscription_tier).toLowerCase() : "free",
            stored_tier: user.subscription_tier || "free",
            is_active: subscriptionActive,
            store: user.subscription_store || null,
            product_id: user.subscription_product_id || null,
            expires_at: user.subscription_expires_at || null,
            started_at: user.subscription_started_at || null,
            updated_at: user.subscription_updated_at || null,
            is_manual: user.subscription_store === "promotional",
        },
    };
};

export const getManagedUser = async (targetUserId) => {
    const userId = Number(targetUserId);
    if (!Number.isInteger(userId) || userId < 1) {
        throw new HttpError(400, "Invalid user ID.");
    }
    const user = await findManagedUserById(userId);
    if (!user) throw new HttpError(404, "User not found.");
    return serializeManagedUser(user);
};

export const updateManagedUser = async ({ targetUserId, updates, adminUserId }) => {
    const userId = Number(targetUserId);
    if (!Number.isInteger(userId) || userId < 1) {
        throw new HttpError(400, "Invalid user ID.");
    }

    const subscriptionAction = updates.subscription_action || "unchanged";
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const existing = await findManagedUserById(userId, connection);
        if (!existing) throw new HttpError(404, "User not found.");

        const targetIsAdmin = ADMIN_ROLES.has(String(existing.role || "").toLowerCase());
        if (targetIsAdmin && Number(adminUserId) !== userId) {
            throw new HttpError(403, "Other admin accounts cannot be edited here.");
        }

        await connection.execute(
            `UPDATE api_user
             SET username = ?, email = ?, is_active = ?, is_verified = ?,
                 profile_completed = ?
             WHERE id = ?`,
            [
                updates.username.trim(),
                updates.email.trim().toLowerCase(),
                updates.is_active ? 1 : 0,
                updates.is_verified ? 1 : 0,
                updates.profile_completed ? 1 : 0,
                userId,
            ]
        );

        await connection.execute(
            `INSERT INTO api_userprofile
                (full_name, age, class_level, exam_board, profile_pic_url, user_id)
             VALUES (?, ?, ?, ?, NULL, ?)
             ON DUPLICATE KEY UPDATE
                full_name = VALUES(full_name), age = VALUES(age),
                class_level = VALUES(class_level), exam_board = VALUES(exam_board)`,
            [
                updates.full_name.trim(),
                updates.age ?? null,
                updates.class_level,
                updates.exam_board,
                userId,
            ]
        );

        if (subscriptionAction === "grant") {
            if (existing.subscription_store && existing.subscription_store !== "promotional") {
                throw new HttpError(
                    409,
                    "Store subscriptions cannot be replaced with a manual grant. Manage this subscription through RevenueCat."
                );
            }
            const tier = String(updates.subscription_tier || "").toLowerCase();
            if (!PREMIUM_TIERS.has(tier)) {
                throw new HttpError(400, "Manual grants must use the Plus or Pro tier.");
            }
            const expiresAt = updates.subscription_expires_at
                ? new Date(updates.subscription_expires_at)
                : null;
            if (expiresAt && expiresAt <= new Date()) {
                throw new HttpError(400, "The premium grant expiry must be in the future.");
            }
            await connection.execute(
                `INSERT INTO api_usersubscription
                    (tier, revenuecat_app_user_id, store, product_id, is_active,
                     expires_at, original_purchase_date, cancellation_date,
                     last_webhook_event, created_at, updated_at, user_id)
                 VALUES (?, NULL, 'promotional', 'manual_admin_grant', 1,
                         ?, NOW(), NULL, 'MANUAL_ADMIN_GRANT', NOW(), NOW(), ?)
                 ON DUPLICATE KEY UPDATE
                    tier = VALUES(tier), store = 'promotional',
                    product_id = 'manual_admin_grant', is_active = 1,
                    expires_at = VALUES(expires_at),
                    original_purchase_date = COALESCE(original_purchase_date, NOW()),
                    cancellation_date = NULL,
                    last_webhook_event = 'MANUAL_ADMIN_GRANT', updated_at = NOW()`,
                [tier, expiresAt, userId]
            );
        } else if (subscriptionAction === "revoke") {
            if (existing.subscription_store && existing.subscription_store !== "promotional") {
                throw new HttpError(
                    409,
                    "Store subscriptions cannot be revoked manually. Manage this subscription through RevenueCat."
                );
            }
            await connection.execute(
                `UPDATE api_usersubscription
                 SET tier = 'free', is_active = 0, expires_at = NOW(),
                     cancellation_date = NOW(), last_webhook_event = 'MANUAL_ADMIN_REVOKE',
                     updated_at = NOW()
                 WHERE user_id = ? AND store = 'promotional'`,
                [userId]
            );
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        if (error?.code === "ER_DUP_ENTRY") {
            throw new HttpError(409, "That email address or username is already in use.");
        }
        throw error;
    } finally {
        connection.release();
    }

    console.info(
        `Admin updated user: user_id=${userId}, admin_id=${adminUserId || "token"}, subscription_action=${subscriptionAction}`
    );
    return getManagedUser(userId);
};

export const deleteManagedUser = async ({ targetUserId, adminUserId }) => {
    const normalizedUserId = Number(targetUserId);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId < 1) {
        throw new HttpError(400, "Invalid user ID.");
    }
    const user = await findUserByIdSafe(normalizedUserId);
    if (!user) {
        throw new HttpError(404, "User not found.");
    }
    if (adminUserId && normalizedUserId === Number(adminUserId)) {
        throw new HttpError(400, "You cannot delete your own admin account.");
    }
    if (ADMIN_ROLES.has(String(user.role || "").toLowerCase())) {
        throw new HttpError(403, "Admin accounts cannot be deleted from user management.");
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await deletePendingRegistrationForUser(connection, user);
        await deleteDependentRows(
            connection,
            process.env.DB_NAME,
            "api_user",
            "id",
            normalizedUserId
        );
        const [result] = await connection.execute(
            "DELETE FROM api_user WHERE id = ?",
            [normalizedUserId]
        );
        if (result.affectedRows !== 1) {
            throw new Error("The user was not deleted.");
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    console.info(`Admin deleted user: user_id=${user.id}, email=${user.email}`);
    return { deleted: true, user_id: Number(user.id), email: user.email };
};

export const deleteManagedUsers = async ({ targetUserIds, adminUserId }) => {
    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
        throw new HttpError(400, "Select at least one user to delete.");
    }
    if (targetUserIds.length > 100) {
        throw new HttpError(400, "A maximum of 100 users can be deleted at once.");
    }

    const userIds = [...new Set(targetUserIds.map(Number))];
    if (userIds.some((id) => !Number.isInteger(id) || id < 1)) {
        throw new HttpError(400, "One or more user IDs are invalid.");
    }

    const users = await Promise.all(userIds.map((id) => findUserByIdSafe(id)));
    if (users.some((user) => !user)) {
        throw new HttpError(404, "One or more selected users no longer exist.");
    }
    if (adminUserId && userIds.includes(Number(adminUserId))) {
        throw new HttpError(400, "You cannot delete your own admin account.");
    }
    if (users.some((user) => ADMIN_ROLES.has(String(user.role || "").toLowerCase()))) {
        throw new HttpError(403, "Admin accounts cannot be deleted from user management.");
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (let index = 0; index < userIds.length; index += 1) {
            const userId = userIds[index];
            const user = users[index];
            await deletePendingRegistrationForUser(connection, user);
            await deleteDependentRows(
                connection,
                process.env.DB_NAME,
                "api_user",
                "id",
                userId
            );
            const [result] = await connection.execute(
                "DELETE FROM api_user WHERE id = ?",
                [userId]
            );
            if (result.affectedRows !== 1) {
                throw new Error(`User ${userId} was not deleted.`);
            }
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    console.info(`Admin bulk deleted users: user_ids=${userIds.join(",")}`);
    return {
        deleted: true,
        deleted_count: userIds.length,
        user_ids: userIds,
        emails: users.map((user) => user.email),
    };
};
