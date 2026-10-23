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
        // Only for reads: a write that dropped mid-flight may already have
        // been applied, and retrying it could insert a duplicate.
        const isRead = /^\s*SELECT\b/i.test(sql);
        if (!connection && isRead && TRANSIENT_CODES.has(error?.code)) {
            const [rows] = await pool.execute(sql, params);
            return rows;
        }
        throw error;
    }
};
