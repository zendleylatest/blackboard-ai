import bcrypt from "bcrypt";

import { findUserByEmail } from "../models/auth/User.js";
import { ensureAdminProfile, upsertAdminUser } from "../models/System.js";

export const ensureDefaultAdmin = async () => {
    const email = String(process.env.DEFAULT_ADMIN_EMAIL || "")
        .trim()
        .toLowerCase();
    const password = String(process.env.DEFAULT_ADMIN_PASSWORD || "");

    if (!email && !password) {
        return;
    }
    if (!email || !password) {
        throw new Error(
            "DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD must both be set."
        );
    }
    if (password.length < 8) {
        throw new Error("DEFAULT_ADMIN_PASSWORD must be at least 8 characters.");
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
        if (
            String(existingUser.role || "").toLowerCase() !== "admin" ||
            !existingUser.is_staff ||
            !existingUser.is_verified ||
            !existingUser.is_active
        ) {
            throw new Error(
                `DEFAULT_ADMIN_EMAIL already belongs to a non-admin account: ${email}`
            );
        }
        console.log(`[ADMIN] Default admin ready: ${email}`);
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await upsertAdminUser({
        email,
        password: hashedPassword,
        isSuperuser: true,
    });
    await ensureAdminProfile({
        userId: user.id,
        fullName: "Blackboard Admin",
        age: 18,
        classLevel: "A",
        examBoard: "cambridge",
    });

    console.log(`[ADMIN] Created default admin: ${email}`);
};
