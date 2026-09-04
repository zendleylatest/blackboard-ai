import { query, param } from "express-validator";

/*
|--------------------------------------------------------------------------
| GET /documents/
|--------------------------------------------------------------------------
*/

export const listDocumentsValidation = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("page must be a positive integer"),

    query("page_size")
        .optional()
        .isInt({ min: 1 })
        .withMessage("page_size must be a positive integer"),

    query("subject_id")
        .optional()
        .isInt({ min: 1 })
        .withMessage("subject_id must be a valid integer"),

    query("document_type")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 50 })
        .withMessage("document_type must be valid"),

    query("year")
        .optional()
        .isInt()
        .withMessage("year must be a valid integer"),
];

/*
|--------------------------------------------------------------------------
| Document ID Validation
|--------------------------------------------------------------------------
*/

export const documentIdValidation = [
    param("document_id")
        .isInt({ min: 1 })
        .withMessage("document_id must be a valid integer"),
];

/*
|--------------------------------------------------------------------------
| Document ID Validation
|--------------------------------------------------------------------------
*/

export const docIdValidation = [
    param("doc_id")
        .isInt({ min: 1 })
        .withMessage("doc_id must be a valid integer"),
];

/*
|--------------------------------------------------------------------------
| Signed URL Validation
|--------------------------------------------------------------------------
*/

export const signedUrlValidation = [
    param("document_id")
        .isInt({ min: 1 })
        .withMessage("document_id must be a valid integer"),

    query("ttl")
        .optional()
        .isInt({ min: 1, max: 3600 })
        .withMessage("ttl must be between 1 and 3600 seconds"),
];

export const getSubjectDocumentsValidation = [
    param("subject_id")
        .isInt({ min: 1 })
        .withMessage("subject_id must be a valid integer"),

    query("type")
        .optional()
        .isString()
        .withMessage("type must be a string"),

    query("year")
        .optional()
        .isInt()
        .withMessage("year must be a valid integer"),

    query("paper")
        .optional()
        .isInt({ min: 1 })
        .withMessage("paper must be a valid integer"),

    query("variant")
        .optional()
        .isInt({ min: 1 })
        .withMessage("variant must be a valid integer"),

    query("search")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 200 })
        .withMessage("search must be a valid search string"),
];
