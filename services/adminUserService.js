import pool from "../config/database.js";
import { countManagedUsers, findManagedUsers } from "../models/AdminUser.js";
import { findUserByIdSafe } from "../models/auth/User.js";
import HttpError from "../utils/httpError.js";

const ADMIN_ROLES = new Set(["admin", "staff", "superadmin"]);

const quoteIdentifier = (value) => `\`${String(value).replaceAll("`", "``")}\``;

const deletePendingRegistrationForUser = async (connection, user) => {
    await connection.execute(
        `DELETE FROM api_pendinguser
         WHERE LOWER(email) = LOWER(?)
            OR LOWER(username) = LOWER(?)`,
        [user.email, user.username]
    );
};

const getReferences = async (connection, schema, table, column) => {
    const [rows] = await connection.execute(
        `
        SELECT k.TABLE_NAME AS child_table, k.COLUMN_NAME AS child_column
        FROM information_schema.KEY_COLUMN_USAGE k
        WHERE k.CONSTRAINT_SCHEMA = ?
          AND k.REFERENCED_TABLE_NAME = ?
          AND k.REFERENCED_COLUMN_NAME = ?
        ORDER BY k.TABLE_NAME, k.COLUMN_NAME
        `,
        [schema, table, column]
    );
    return rows;
};

const getPrimaryKey = async (connection, schema, table) => {
    const [rows] = await connection.execute(
        `
        SELECT COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE CONSTRAINT_SCHEMA = ?
          AND TABLE_NAME = ?
          AND CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY ORDINAL_POSITION
        `,
        [schema, table]
    );
    if (rows.length !== 1) {
        throw new Error(`Cannot safely cascade deletion through ${table}.`);
    }
    return rows[0].COLUMN_NAME;
};

const deleteDependentRows = async (
    connection,
    schema,
    parentTable,
    parentColumn,
    parentValue,
    ancestry = new Set()
) => {
    const nodeKey = `${parentTable}.${parentColumn}`;
    if (ancestry.has(nodeKey)) {
        throw new Error(`Cyclic foreign-key dependency detected at ${nodeKey}.`);
    }
    const nextAncestry = new Set(ancestry).add(nodeKey);
    const references = await getReferences(
        connection,
        schema,
        parentTable,
        parentColumn
    );

    for (const reference of references) {
        const childTable = reference.child_table;
        const childColumn = reference.child_column;
        const primaryKey = await getPrimaryKey(connection, schema, childTable);
        const [children] = await connection.execute(
            `SELECT ${quoteIdentifier(primaryKey)} AS id
             FROM ${quoteIdentifier(childTable)}
             WHERE ${quoteIdentifier(childColumn)} = ?`,
            [parentValue]
        );

        for (const child of children) {
            await deleteDependentRows(
                connection,
                schema,
                childTable,
                primaryKey,
                child.id,
                nextAncestry
            );
        }

        await connection.execute(
            `DELETE FROM ${quoteIdentifier(childTable)}
             WHERE ${quoteIdentifier(childColumn)} = ?`,
            [parentValue]
        );
    }
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
