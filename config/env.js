import dotenv from "dotenv";

dotenv.config();

export const PORT = process.env.PORT || 8000;

export const NODE_ENV = process.env.NODE_ENV || "development";

// Database
export const DB_NAME = process.env.DB_NAME;
export const DB_USER = process.env.DB_USER;
export const DB_PASSWORD = process.env.DB_PASSWORD;
export const DB_HOST = process.env.DB_HOST;
export const DB_PORT = process.env.DB_PORT || 3306;
export const LOCAL_STORAGE_ROOT = process.env.LOCAL_STORAGE_ROOT;

// JWT
export const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY;
export const JWT_EXPIRES = process.env.JWT_EXPIRES || "1h";

const requiredServerEnv = [
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "DB_HOST",
    "DB_PORT",
    "LOCAL_STORAGE_ROOT",
];

const optionalFeatureEnv = [
    "OPENAI_API_KEY",
    "GOOGLE_CLIENT_ID",
    "PUBLIC_BASE_URL",
    "APPLE_BUNDLE_ID",
    "REVENUECAT_WEBHOOK_AUTH_KEY",
];

export const validateEnvironment = () => {
    const missing = requiredServerEnv.filter(
        (key) => !String(process.env[key] || "").trim()
    );

    if (!String(JWT_SECRET || "").trim()) {
        missing.push("JWT_SECRET or SECRET_KEY");
    }

    if (missing.length) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}`
        );
    }

    const missingOptional = optionalFeatureEnv.filter(
        (key) => !String(process.env[key] || "").trim()
    );

    if (missingOptional.length) {
        console.warn(
            `[ENV] Optional feature variables missing: ${missingOptional.join(", ")}. Related routes may return a configuration error until these are set.`
        );
    }
};
