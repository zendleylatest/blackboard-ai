// Firebase Admin SDK initialization
import {
    applicationDefault,
    cert,
    getApps,
    initializeApp,
} from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

const getCredential = () => {
    const encoded = process.env.FIREBASE_CREDENTIALS_JSON || "";
    if (!encoded) return applicationDefault();

    const credentials = JSON.parse(
        Buffer.from(encoded, "base64").toString("utf8")
    );
    return cert(credentials);
};

export const getFirebaseMessaging = () => {
    if (getApps().length === 0) {
        initializeApp({ credential: getCredential() });
    }
    return getMessaging();
};
