import {
    listDocuments,
    getSubjectDocuments,
    getDocumentDetail,
    generateDocumentSignedUrl,
    getDocumentForStreaming,
    getDocumentBlob,
    getMcqAnswerKey,
} from "../../services/document/documentService.js";

import {
    successResponse,
    errorResponse,
} from "../../utils/apiResponse.js";

import HttpError from "../../utils/httpError.js";

import { Readable } from "stream";


/*
|--------------------------------------------------------------------------
| GET /documents/
|--------------------------------------------------------------------------
*/

export const listDocumentsController = async (
    req,
    res
) => {

    try {

        const documents =
            await listDocuments({
                subjectId:
                    req.query.subject_id,

                documentType:
                    req.query.document_type ||
                    req.query.type,

                year:
                    req.query.year,
            });

        return successResponse(
            res,
            200,
            "Documents retrieved successfully",
            documents
        );

    } catch (error) {

        return errorResponse(
            res,
            error.statusCode || 500,
            error.message
        );
    }
};


export const getSubjectDocumentsController = async (
    req,
    res,
    next
) => {
    try {
        const subjectId = req.params.subject_id;

        const filters = {
            documentType:
                req.query.type ||
                req.query.document_type ||
                null,
            year: req.query.year || null,
            paper: req.query.paper || null,
            variant: req.query.variant || null,
            search: req.query.search || null,
        };

        const result = await getSubjectDocuments(
            subjectId,
            filters,
            req.user.id
        );

        return successResponse(
            res,
            200,
            "Documents retrieved successfully",
            {
                documents: result.documents,
                count: result.count,
            }
        );

    } catch (error) {
        next(error);
    }
};


/*
|--------------------------------------------------------------------------
| GET /documents/:document_id/
|--------------------------------------------------------------------------
*/

export const getDocumentDetailController = async (
    req,
    res
) => {

    try {

        const document =
            await getDocumentDetail(
                req.params.document_id
            );

        return successResponse(
            res,
            200,
            "Document retrieved successfully",
            document
        );

    } catch (error) {

        return errorResponse(
            res,
            error.statusCode || 500,
            error.message
        );
    }
};


/*
|--------------------------------------------------------------------------
| GET /documents/:document_id/signed-url/
|--------------------------------------------------------------------------
*/

export const documentSignedUrlController = async (
    req,
    res
) => {

    try {

        const ttl =
            Number(req.query.ttl || 600);

        const result =
            await generateDocumentSignedUrl(
                req.params.document_id,
                ttl
            );

        return successResponse(
            res,
            200,
            "Signed URL generated successfully",
            result
        );

    } catch (error) {

        return errorResponse(
            res,
            error.statusCode || 500,
            error.message
        );
    }
};


/*
|--------------------------------------------------------------------------
| GET /documents/:doc_id/content/
|--------------------------------------------------------------------------
*/

export const documentContentController = async (
    req,
    res
) => {

    try {

        const document =
            await getDocumentForStreaming(
                req.params.doc_id,
                req.user.id
            );

        const {
            blob,
            metadata,
        } = await getDocumentBlob(
            document.gcs_key
        );

        const total =
            Number(metadata.size || 0);

        const rangeHeader =
            req.headers.range;

        let start = 0;
        let end = total - 1;
        let statusCode = 200;

        if (rangeHeader) {

            const match =
                rangeHeader.match(
                    /bytes=(\d*)-(\d*)/
                );

            if (!match) {

                return res
                    .status(416)
                    .set(
                        "Content-Range",
                        `bytes */${total}`
                    )
                    .end();
            }

            const requestedStart =
                match[1] !== ""
                    ? Number(match[1])
                    : null;

            const requestedEnd =
                match[2] !== ""
                    ? Number(match[2])
                    : null;

            if (
                requestedStart === null &&
                requestedEnd !== null
            ) {

                start = Math.max(
                    0,
                    total - requestedEnd
                );

                end = total - 1;

            } else {

                start =
                    requestedStart ?? 0;

                end =
                    requestedEnd ?? total - 1;
            }

            if (
                start > end ||
                start >= total
            ) {

                return res
                    .status(416)
                    .set(
                        "Content-Range",
                        `bytes */${total}`
                    )
                    .end();
            }

            statusCode = 206;
        }

        const contentLength =
            end - start + 1;

        const readStream =
            blob.createReadStream({
                start,
                end,
            });

        const filename =
            sanitizeFilename(
                document.title
            );

        res.status(statusCode);

        res.set({
            "Content-Type":
                "application/pdf",

            "Content-Disposition":
                `inline; filename="${filename}.pdf"`,

            "Accept-Ranges":
                "bytes",

            "Cache-Control":
                "private, max-age=600",

            "Content-Length":
                String(contentLength),

            "X-Accel-Buffering":
                "no",
        });

        if (statusCode === 206) {

            res.set(
                "Content-Range",
                `bytes ${start}-${end}/${total}`
            );
        }

        readStream.on(
            "error",
            (error) => {

                if (!res.headersSent) {

                    return errorResponse(
                        res,
                        500,
                        error.message
                    );
                }

                res.destroy(error);
            }
        );

        return readStream.pipe(res);

    } catch (error) {

        return errorResponse(
            res,
            error.statusCode || 500,
            error.message
        );
    }
};


/*
|--------------------------------------------------------------------------
| GET /documents/:doc_id/download/
|--------------------------------------------------------------------------
*/

export const documentDownloadController = async (
    req,
    res
) => {

    try {

        const document =
            await getDocumentForStreaming(
                req.params.doc_id,
                req.user.id
            );

        const {
            blob,
            metadata,
        } = await getDocumentBlob(
            document.gcs_key
        );

        const filename =
            sanitizeFilename(
                document.title
            );

        res.set({

            "Content-Type":
                "application/pdf",

            "Content-Disposition":
                `attachment; filename="${filename}.pdf"`,

            "Cache-Control":
                "private, max-age=600",

            "Content-Length":
                String(metadata.size),
        });

        const readStream =
            blob.createReadStream();

        readStream.on(
            "error",
            (error) => {

                if (!res.headersSent) {

                    return errorResponse(
                        res,
                        500,
                        error.message
                    );
                }

                res.destroy(error);
            }
        );

        return readStream.pipe(res);

    } catch (error) {

        return errorResponse(
            res,
            error.statusCode || 500,
            error.message
        );
    }
};


/*
|--------------------------------------------------------------------------
| GET /documents/:doc_id/debug/
|--------------------------------------------------------------------------
*/

export const debugDocumentAccessController = async (
    req,
    res
) => {

    try {

        const document =
            await getDocumentForStreaming(
                req.params.doc_id,
                req.user.id
            );

        const {
            blob,
            metadata,
        } = await getDocumentBlob(
            document.gcs_key
        );

        const debugInfo = {

            doc_id:
                document.id,

            doc_title:
                document.title,

            gcs_key:
                document.gcs_key,

            bucket_name:
                process.env.GCS_BUCKET_NAME,

            blob_exists:
                true,

            blob_size:
                Number(metadata.size || 0),

            service_account:
                process.env.RUN_SERVICE_ACCOUNT_EMAIL ||
                "not_set",
        };

        const size =
            Number(metadata.size || 0);

        if (size > 0) {

            const [
                sampleData,
            ] = await blob.download({
                start: 0,
                end: Math.min(
                    99,
                    size - 1
                ),
            });

            debugInfo.sample_length =
                sampleData.length;

            debugInfo.is_pdf =
                sampleData
                    .subarray(0, 4)
                    .toString() === "%PDF";

            debugInfo.first_bytes =
                sampleData
                    .subarray(0, 20)
                    .toString("hex");
        }

        return successResponse(
            res,
            200,
            "Document access debug information retrieved",
            debugInfo
        );

    } catch (error) {

        return errorResponse(
            res,
            error.statusCode || 500,
            error.message
        );
    }
};


/*
|--------------------------------------------------------------------------
| GET /documents/:document_id/mcq-key/
|--------------------------------------------------------------------------
*/

export const getMcqKeyController = async (
    req,
    res
) => {

    try {

        const answerKey =
            await getMcqAnswerKey(
                req.params.document_id
            );

        return successResponse(
            res,
            200,
            "MCQ answer key retrieved successfully",
            answerKey
        );

    } catch (error) {

        return errorResponse(
            res,
            error.statusCode || 500,
            error.message
        );
    }
};


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const sanitizeFilename = (
    filename = "document"
) => {

    return filename
        .replace(/["\\\/]/g, "")
        .replace(/[^\w\s.-]/g, "")
        .trim() || "document";
};
