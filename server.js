import cluster from "cluster";
import dotenv from "dotenv";
import os from "os";

dotenv.config();

import app from "./app.js";

import { testConnection } from "./config/database.js";
import { validateEnvironment } from "./config/env.js";
import { logFirebaseStatus } from "./config/firebase.js";
import { ensureDefaultAdmin } from "./services/defaultAdminService.js";
import { ensureStorageDirectories } from "./utils/localStorage.js";

const PORT = process.env.PORT || 8000;

const startServer = async () => {
    try {

        validateEnvironment();

        await ensureStorageDirectories();

        await testConnection();

        await ensureDefaultAdmin();

        logFirebaseStatus();

        const server = app.listen(PORT, () => {
            console.log(
                `Server running on port ${PORT}`
            );
        });

        // Node closes idle keep-alive connections after 5s by default. iOS
        // (and the Dart HTTP client) reuse a pooled connection a bit later,
        // hit one the server just closed, and the request fails with
        // "Connection closed before full header was received" even though
        // nothing is wrong. Keep idle connections open longer than any
        // client/proxy (nginx's default upstream keep-alive is 60s).
        server.keepAliveTimeout = 65 * 1000;
        server.headersTimeout = 66 * 1000;
        server.requestTimeout = 0; // long AI requests must not be cut off

    } catch (error) {

        console.error(
            "Failed to start server"
        );

        console.error(error);

        process.exit(1);

    }
};

const startWorker = () => {
    startServer();
};

if (
    process.env.NODE_ENV === "production" &&
    cluster.isPrimary
) {
    const workerCount = Math.max(
        1,
        Number(process.env.WEB_CONCURRENCY || os.cpus().length)
    );
    for (let index = 0; index < workerCount; index += 1) {
        cluster.fork();
    }
    cluster.on("exit", (worker) => {
        console.error(`Worker ${worker.process.pid} exited; restarting.`);
        cluster.fork();
    });
} else {
    startWorker();
}
