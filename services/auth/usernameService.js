import {
    findUserByUsername,
} from "../../models/auth/User.js";

import {
    findPendingUserByUsername,
} from "../../models/auth/PendingUser.js";

const MAX_USERNAME_LENGTH = 150;

const sanitizeUsername = (value, fallback = "user") => {
    const sanitized = String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9@.+_-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, MAX_USERNAME_LENGTH);

    return sanitized || fallback;
};

export const isUsernameAvailable = async (
    username,
    { pendingEmail = null } = {}
) => {
    const [user, pendingUser] = await Promise.all([
        findUserByUsername(username),
        findPendingUserByUsername(username),
    ]);

    const normalizedPendingEmail = String(pendingEmail || "")
        .trim()
        .toLowerCase();
    const pendingRegistrationBelongsToEmail = pendingUser &&
        normalizedPendingEmail &&
        String(pendingUser.email || "").trim().toLowerCase() ===
            normalizedPendingEmail;

    return !user && (!pendingUser || pendingRegistrationBelongsToEmail);
};

export const generateUniqueUsername = async ({
    preferred,
    stableId,
}) => {
    const base = sanitizeUsername(preferred);

    if (await isUsernameAvailable(base)) {
        return base;
    }

    const stableSuffix = sanitizeUsername(stableId, "account")
        .slice(-12);
    const suffixedBase = base.slice(
        0,
        MAX_USERNAME_LENGTH - stableSuffix.length - 1
    );
    const stableCandidate = `${suffixedBase}_${stableSuffix}`;

    if (await isUsernameAvailable(stableCandidate)) {
        return stableCandidate;
    }

    for (let index = 2; index < 1000; index += 1) {
        const suffix = `_${stableSuffix}_${index}`;
        const candidate = `${base.slice(
            0,
            MAX_USERNAME_LENGTH - suffix.length
        )}${suffix}`;

        if (await isUsernameAvailable(candidate)) {
            return candidate;
        }
    }

    throw new Error("Unable to generate a unique username.");
};
