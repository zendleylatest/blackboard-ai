import HttpError from "../utils/httpError.js";
import { errorResponse } from "../utils/apiResponse.js";

export const errorHandler = (err, req, res, next) => {

    if (err?.type === "entity.parse.failed") {
        return errorResponse(
            res,
            400,
            "Invalid JSON."
        );
    }

    if (err?.code === "LIMIT_FILE_SIZE") {
        return errorResponse(
            res,
            413,
            "Uploaded file exceeds the allowed size limit."
        );
    }

    if (err instanceof HttpError) {
        return errorResponse(
            res,
            err.statusCode,
            err.message
        );
    }

    console.error(err);

    return errorResponse(
        res,
        err.statusCode || 500,
        err.message || "Internal Server Error."
    );
};
