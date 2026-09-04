class HttpError extends Error {
    constructor(statusCode, message) {
        // Early auth/profile services used the legacy (message, status)
        // ordering. Accept both forms while the conversion is completed so
        // those paths still return the Python-equivalent HTTP status.
        if (typeof statusCode === "string" && typeof message === "number") {
            [statusCode, message] = [message, statusCode];
        }
        super(message);

        this.name = "HttpError";
        this.statusCode = statusCode;

        Error.captureStackTrace(this, this.constructor);
    }
}

export default HttpError;
