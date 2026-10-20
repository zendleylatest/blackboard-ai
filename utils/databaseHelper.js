import pool from "../config/database.js";

const TRANSIENT_CODES = new Set([
    "ECONNRESET",
    "EPIPE",
    "ETIMEDOUT",
    "PROTOCOL_CONNECTION_LOST",
    "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
]);

export const executeQuery = async (
    sql,
    params = [],
    connection = null
) => {
    const executor = connection || pool;

    try {
        const [rows] = await executor.execute(sql, params);
        return rows;
    } catch (error) {
        // A stale pooled connection fails once; retry on a fresh one. Not done
        // on an explicit connection (transaction), where a retry would run
        // outside it.
        if (!connection && TRANSIENT_CODES.has(error?.code)) {
            const [rows] = await pool.execute(sql, params);
            return rows;
        }
        throw error;
    }
};
