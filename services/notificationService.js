import HttpError from "../utils/httpError.js";
import { getFirebaseMessaging, isFirebaseConfigured } from "../config/firebase.js";
import {
    deactivateTokens,
    findBroadcastTokens,
    registerToken,
    unregisterToken,
} from "../models/Notification.js";

export const registerDeviceToken = async (
    userId,
    { token, platform }
) => {
    const created = await registerToken({
        userId,
        token,
        platform,
    });
    return {
        status: "registered",
        created,
    };
};

export const unregisterDeviceToken = async (userId, token) => {
    await unregisterToken(userId, token);
    return { status: "unregistered" };
};

export const broadcastNotification = async (
    user,
    { title, body, tier }
) => {
    if (!["admin", "staff", "superadmin"].includes(String(user.role || "").toLowerCase())) {
        throw new HttpError(403, "Admin access required.");
    }
    if (!isFirebaseConfigured()) {
        throw new HttpError(
            503,
            "Push notifications are not set up on the server: add the Firebase service-account file at backend_nodejs/credentials/firebase-service-account.json (or set FIREBASE_CREDENTIALS_JSON) and restart."
        );
    }
    const rows = await findBroadcastTokens(tier);
    const tokens = rows.map((row) => row.token);
    if (tokens.length === 0) {
        return {
            status: "no_active_tokens",
            sent: 0,
        };
    }

    const messaging = getFirebaseMessaging();
    let totalSuccess = 0;
    let totalFailure = 0;
    const invalidTokens = [];

    for (let index = 0; index < tokens.length; index += 500) {
        const batch = tokens.slice(index, index + 500);
        const response = await messaging.sendEachForMulticast({
            notification: { title, body },
            // Play the default sound on iOS and show promptly on Android.
            apns: { payload: { aps: { sound: "default" } } },
            android: { priority: "high" },
            tokens: batch,
        });
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;
        response.responses.forEach((result, responseIndex) => {
            const code = result.error?.code || "";
            if ([
                "messaging/registration-token-not-registered",
                "messaging/invalid-registration-token",
                "messaging/invalid-argument",
            ].includes(code)) {
                invalidTokens.push(batch[responseIndex]);
            }
        });
    }

    await deactivateTokens(invalidTokens);

    return {
        status: "sent",
        total_tokens: tokens.length,
        success: totalSuccess,
        failure: totalFailure,
    };
};

/** For the admin dashboard: can pushes be sent, and to how many devices? */
export const getNotificationStatus = async () => {
    const rows = await findBroadcastTokens(null);
    return {
        configured: isFirebaseConfigured(),
        registered_devices: rows.length,
    };
};
