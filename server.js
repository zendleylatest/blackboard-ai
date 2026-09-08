import cluster from "cluster";
import dotenv from "dotenv";
import os from "os";

dotenv.config();

import app from "./app.js";

import { testConnection } from "./config/database.js";
import { validateEnvironment } from "./config/env.js";
import { ensureDefaultAdmin } from "./services/defaultAdminService.js";

const PORT = process.env.PORT || 8000;

const startServer = async () => {
    try {

        validateEnvironment();

        await testConnection();

        await ensureDefaultAdmin();

        app.listen(PORT, () => {
            console.log(
                `Server running on port ${PORT}`
            );
        });

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
