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
