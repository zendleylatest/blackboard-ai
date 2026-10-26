// Firebase Admin SDK initialization (push notifications).
//
// The service-account key is looked up in this order:
//   1. FIREBASE_CREDENTIALS_JSON         - the JSON, base64 encoded
//   2. FIREBASE_SERVICE_ACCOUNT_PATH     - path to the JSON file
//   3. credentials/firebase-service-account.json  (default drop-in location)
//   4. GOOGLE_APPLICATION_CREDENTIALS / the platform's default credentials
//
// Get the file from Firebase console > Project settings > Service accounts >
// "Generate new private key". Never commit it (credentials/ is git-ignored).
import fs from "fs";
import path from "path";
import {
    applicationDefault,
    cert,
    getApps,
    initializeApp,
} from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

const DEFAULT_KEY_FILE = path.resolve(
    process.cwd(),
    "credentials",
    "firebase-service-account.json"
);

const keyFilePath = () => {
    const configured = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "").trim();
    return configured ? path.resolve(process.cwd(), configured) : DEFAULT_KEY_FILE;
};

const readServiceAccount = () => {
    const encoded = (process.env.FIREBASE_CREDENTIALS_JSON || "").trim();
    if (encoded) {
        return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    }
    const file = keyFilePath();
    if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    }
    return null;
};

/** Is a service-account key available (or default credentials configured)? */
export const isFirebaseConfigured = () => {
    try {
        if (readServiceAccount()) return true;
    } catch {
        return false; // present but unreadable / invalid JSON
    }
    return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
};

const getCredential = () => {
    const account = readServiceAccount();
    return account ? cert(account) : applicationDefault();
};

export const getFirebaseMessaging = () => {
    if (getApps().length === 0) {
        const options = { credential: getCredential() };
        const projectId = (process.env.FIREBASE_PROJECT_ID || "").trim();
        if (projectId) options.projectId = projectId;
        initializeApp(options);
    }
    return getMessaging();
};
