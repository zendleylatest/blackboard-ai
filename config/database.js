import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    charset: "utf8mb4",

    // Idle pooled connections get dropped by MySQL / the network, so the next
    // request that picked one up failed with ECONNRESET / "Connection lost"
    // (the "server error sometimes"). Keep them alive.
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
});

export default pool;

export const getConnection = async () => {
    return await pool.getConnection();
};

export const testConnection = async () => {
    const connection = await getConnection();

    try {
        await connection.ping();
        console.log("Database Connected Successfully");
    } finally {
        connection.release();
    }
};