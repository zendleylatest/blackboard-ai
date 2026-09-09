import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth/authRoutes.js";
import profileRoutes from "./routes/profile/profileRoutes.js";
import subjectRoutes from "./routes/subjects/subjectRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import flashcardRoutes from "./routes/flashcardRoutes.js";
import ragRoutes from "./routes/ragRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import chatThreadRoutes from "./routes/chatThreadRoutes.js";
import aiCheckerRoutes from "./routes/aiCheckerRoutes.js";
// df
import studySessionRoutes from "./routes/studySessionRoutes.js";
import systemRoutes from "./routes/systemRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";

import { errorHandler } from "./middleware/errorHandler.js";
import { profileImagesDirectory } from "./utils/localStorage.js";

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(
    "/media/profile-images",
    express.static(profileImagesDirectory, {
        dotfiles: "deny",
        fallthrough: false,
        index: false,
        immutable: true,
        maxAge: "30d",
    })
);

app.use((req, res, next) => {
    if (req.path.startsWith("/api/auth")) {
        console.log(`[AUTH] ${req.method} ${req.path}`);
    }
    next();
});

// ======================================================
// API ROUTES
// ======================================================

app.use("/api/auth", authRoutes);
app.use("/api/auth/profile", profileRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api", documentRoutes);
app.use("/api", quizRoutes);
app.use("/api", flashcardRoutes);
app.use("/api", ragRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/chat/threads", chatThreadRoutes);
app.use("/api/chat-threads", chatThreadRoutes);
app.use("/api", aiCheckerRoutes);
app.use("/api", studySessionRoutes);
app.use("/api", systemRoutes);
app.use("/api", subscriptionRoutes);
app.use("/api", notificationRoutes);
app.use("/api", analyticsRoutes);

// ======================================================
// HEALTH CHECK
// ======================================================

const healthCheck = (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Server is running.",
    });
};

app.get("/health", healthCheck);
app.get("/api/health/", healthCheck);

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(errorHandler);

export default app;
