import HttpError from "../../utils/httpError.js";
import { getConnection } from "../../config/database.js";
import { deleteDependentRows } from "../../utils/cascadeDelete.js";

import {
    findUserByIdSafe,
    deleteUserById,
} from "../../models/auth/User.js";

export const deleteAccountService = async (
    userId
) => {

    const user =
        await findUserByIdSafe(
            userId
        );

    if (!user) {

        throw new HttpError(
            "User not found.",
            404
        );

    }

    const connection = await getConnection();

    try {

        await connection.beginTransaction();

        // Explicitly clear every dependent row first (recursively) — some
        // FK constraints on the live database aren't set up to cascade,
        // so this can't rely on the DB doing it automatically.
        await deleteDependentRows(
            connection,
            process.env.DB_NAME,
            "api_user",
            "id",
            user.id
        );

        // Tables keyed by user_id / email WITHOUT a foreign key to api_user
        // are invisible to the schema-driven cascade above, so they must be
        // cleared explicitly — otherwise their rows survive the deletion and
        // resurface as "old data" when the same email signs up again (or
        // when the database ever hands the same user id out again).
        for (const [table, column, value] of [
            ["api_aiusagelog", "user_id", user.id],
            ["api_devicetoken", "user_id", user.id],
            ["api_userusagelimit", "user_id", user.id],
            ["api_pendinguser", "email", user.email],
        ]) {
            try {
                await connection.execute(
                    `DELETE FROM \`${table}\` WHERE ${column === "email" ? "LOWER(email) = LOWER(?)" : `${column} = ?`}`,
                    [value]
                );
            } catch (error) {
                // Table/column may not exist in every deployment.
                if (
                    error.code !== "ER_NO_SUCH_TABLE" &&
                    error.code !== "ER_BAD_FIELD_ERROR"
                ) {
                    throw error;
                }
            }
        }

        const deleted =
            await deleteUserById(
                user.id,
                connection
            );

        if (!deleted) {

            throw new HttpError(
                "Failed to delete account.",
                500
            );

        }

        await connection.commit();

    } catch (error) {

        await connection.rollback();

        throw error;

    } finally {

        connection.release();

    }

    console.info(
        `Account deleted: user_id=${user.id}, email=${user.email}`
    );

    return {

        deleted: true,

        message:
            "Your account and all associated data have been permanently deleted.",

    };

};
