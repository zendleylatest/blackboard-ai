import express from "express";

import authRoutes from "./auth/authRoutes.js";
import profileRoutes from "./profile/profileRoutes.js";
import chatThreadRoutes from "./chatThreadRoutes.js";

import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use("/auth", authRoutes);

router.use(
    "/auth/profile",
    authenticate,
    profileRoutes
);

router.use(
    "/chat-threads",
    chatThreadRoutes
);


export default router;
