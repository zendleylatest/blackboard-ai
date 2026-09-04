import HttpError from "../utils/httpError.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { findUserByIdSafe } from "../models/auth/User.js";

const extractIapEmail = (req) => {
    const raw = req.get("X-Goog-Authenticated-User-Email") ||
        req.get("X-Forwarded-User") ||
        "";
    return raw.includes(":")
        ? raw.split(":", 2)[1].trim()
        : raw.trim();
};

export const authorizeAnalytics = async (req, res, next) => {
    try {
        const header = req.get("Authorization") || "";
        if (header.startsWith("Bearer ")) {
            try {
                const decoded = verifyAccessToken(header.slice(7));
                const user = await findUserByIdSafe(decoded.id);
                if (
                    user &&
                    ["admin", "staff", "superadmin"].includes(
                        String(user.role || "").toLowerCase()
                    )
                ) {
                    req.user = user;
                    return next();
                }
            } catch {
                // Continue to the IAP and analytics-token checks.
            }
        }

        const iapEmail = extractIapEmail(req);
        if (iapEmail) {
            const allowlist = String(process.env.ANALYTICS_ALLOWED_EMAILS || "")
                .split(",")
                .map((email) => email.trim().toLowerCase())
                .filter(Boolean);
            if (allowlist.length === 0 || allowlist.includes(iapEmail.toLowerCase())) {
                req.analyticsIdentity = iapEmail;
                return next();
            }
        }

        const expectedToken = process.env.ANALYTICS_ADMIN_TOKEN || "";
        if (
            expectedToken &&
            req.get("X-Analytics-Token") === expectedToken
        ) {
            return next();
        }

        throw new HttpError(403, "Analytics admin access required.");
    } catch (error) {
        next(error);
    }
};
