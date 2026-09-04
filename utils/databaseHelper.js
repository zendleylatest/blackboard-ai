import pool from "../config/database.js";

export const executeQuery = async (
    sql,
    params = [],
    connection = null
) => {
    const executor = connection || pool;

    const [rows] = await executor.execute(sql, params);

    return rows;
};