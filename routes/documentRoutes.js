import express from "express";

import {
    listDocumentsValidation,
    documentIdValidation,
    docIdValidation,
    getSubjectDocumentsValidation,
} from "../validations/document/documentValidation.js";

import {
    listDocumentsController,
    getDocumentDetailController,
    documentContentController,
    documentDownloadController,
    debugDocumentAccessController,
    getMcqKeyController,
    getSubjectDocumentsController,
} from "../controllers/document/documentController.js";

import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();


// List all documents
router.get(
    "/documents/",
    authenticate,
    listDocumentsValidation,
    validate,
    listDocumentsController
);

// Get document detail
router.get(
    "/documents/:document_id/",
    authenticate,
    documentIdValidation,
    validate,
    getDocumentDetailController
);

// Stream authenticated local document content
router.get(
    "/documents/:doc_id/content/",
    authenticate,
    docIdValidation,
    validate,
    documentContentController
);

// Download document
router.get(
    "/documents/:doc_id/download/",
    authenticate,
    docIdValidation,
    validate,
    documentDownloadController
);

// Debug document access
router.get(
    "/documents/:doc_id/debug/",
    authenticate,
    docIdValidation,
    validate,
    debugDocumentAccessController
);

// Get MCQ answer key
router.get(
    "/documents/:document_id/mcq-key/",
    authenticate,
    documentIdValidation,
    validate,
    getMcqKeyController
);

// Get documents for a specific subject
router.get(
    "/subjects/:subject_id/documents/",
    authenticate,
    getSubjectDocumentsValidation,
    validate,
    getSubjectDocumentsController
);

export default router;
