import {
    findDocuments,
    findDocumentById,
    findDocumentsBySubject,
    findActiveSubjectByIdentifier,
    incrementDocumentDownloadCount,
    isUserEnrolledInSubject,
    findMcqAnswerKeyByQuestionPaper,

} from "../../models/document/Document.js";


import { generateSignedUrl } from "../../utils/gcs.js";

import HttpError from "../../utils/httpError.js";

import { Storage } from "@google-cloud/storage";

const storage = new Storage();

const GCS_BUCKET_NAME =
    process.env.GCS_BUCKET_NAME;

if (!GCS_BUCKET_NAME) {
    throw new Error(
        "GCS_BUCKET_NAME environment variable is required"
    );
}


/*
|--------------------------------------------------------------------------
| List Documents
|--------------------------------------------------------------------------
*/

export const listDocuments = async (filters) => {

    const documents = await findDocuments(filters);

    return documents.map(formatDocument);
};




export const getSubjectDocuments = async (
    subjectId,
    filters = {},
    userId = null
) => {
    const subject = await findActiveSubjectByIdentifier(
        subjectId
    );

    if (!subject) {
        throw new HttpError(
            404,
            "Subject not found"
        );
    }

    if (userId) {
        const enrolled = await isUserEnrolledInSubject(
            userId,
            subject.id
        );

        if (!enrolled) {
            throw new HttpError(
                403,
                "Not enrolled in subject."
            );
        }
    }

    const documents = await findDocumentsBySubject(
        subject.id,
        filters
    );

    return {
        subject,
        documents: documents.map(formatDocument),
        count: documents.length,
    };
};


/*
|--------------------------------------------------------------------------
| Get Document Detail
|--------------------------------------------------------------------------
*/

export const getDocumentDetail = async (
    documentId
) => {

    const document = await findDocumentById(
        documentId
    );

    if (!document) {
        throw new HttpError(
            404,
            "Document not found"
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Preserve Django behavior
    |--------------------------------------------------------------------------
    |
    | The old endpoint increments download_count when the detail endpoint
    | is requested.
    |
    */

    await incrementDocumentDownloadCount(documentId);

    document.download_count =
        Number(document.download_count || 0) + 1;

    return formatDocument(document);
};


/*
|--------------------------------------------------------------------------
| Generate Signed URL
|--------------------------------------------------------------------------
*/

export const generateDocumentSignedUrl = async (
    documentId,
    ttl = 600
) => {

    const document = await findDocumentById(
        documentId
    );

    if (!document) {
        throw new HttpError(
            404,
            "Document not found"
        );
    }

    if (!document.gcs_key) {
        throw new HttpError(
            400,
            "Document does not have a GCS object key"
        );
    }

    const url = await generateSignedUrl(
        document.gcs_key,
        ttl
    );

    return {
        url,
    };
};


/*
|--------------------------------------------------------------------------
| Get Document For Streaming
|--------------------------------------------------------------------------
*/

export const getDocumentForStreaming = async (
    documentId,
    userId
) => {

    const document = await findDocumentById(
        documentId
    );

    if (!document) {
        throw new HttpError(
            404,
            "Document not found"
        );
    }

    const enrolled =
        await isUserEnrolledInSubject(
            userId,
            document.subject_id
        );

    if (!enrolled) {
        /*
        |--------------------------------------------------------------------------
        | Preserve Django behavior
        |--------------------------------------------------------------------------
        |
        | The original endpoint returns 404 for unauthorized subject access
        | instead of exposing whether the document exists.
        |
        */

        throw new HttpError(
            404,
            "Document not found"
        );
    }

    if (!document.gcs_key) {
        throw new HttpError(
            404,
            "File not found"
        );
    }

    return document;
};


/*
|--------------------------------------------------------------------------
| Get GCS Blob
|--------------------------------------------------------------------------
*/

export const getDocumentBlob = async (
    gcsKey
) => {

    const bucket =
        storage.bucket(GCS_BUCKET_NAME);

    const blob =
        bucket.file(gcsKey);

    const [exists] =
        await blob.exists();

    if (!exists) {
        throw new HttpError(
            404,
            "File not found"
        );
    }

    const [metadata] =
        await blob.getMetadata();

    return {
        blob,
        metadata,
    };
};


/*
|--------------------------------------------------------------------------
| Get MCQ Answer Key
|--------------------------------------------------------------------------
*/

export const getMcqAnswerKey = async (
    documentId
) => {

    const document =
        await findDocumentById(
            documentId
        );

    if (!document) {
        throw new HttpError(
            404,
            "Document not found"
        );
    }

    /*
    |--------------------------------------------------------------------------
    | MCQ Eligibility Rule
    |--------------------------------------------------------------------------
    |
    | Paper 1 for all subjects.
    | A Level Economics (9708) Paper 3 is also MCQ.
    |
    */

    const isMcqPaper =
        document.document_type === "past_paper" &&
        (
            Number(document.paper) === 1 ||
            (
                document.subject_code === "9708" &&
                Number(document.paper) === 3
            )
        );

    if (!isMcqPaper) {
        throw new HttpError(
            400,
            "not_mcq_paper"
        );
    }

    const answerKey =
        await findMcqAnswerKeyByQuestionPaper(
            documentId
        );

    if (!answerKey) {
        throw new HttpError(
            404,
            "mcq_key_not_available"
        );
    }

    return {
        question_paper_id: document.id,
        total_questions: answerKey.total_questions,
        answers: parseJsonField(answerKey.answers),
        extraction_method: answerKey.extraction_method,
    };
};


/*
|--------------------------------------------------------------------------
| Document Formatting
|--------------------------------------------------------------------------
*/

const formatDocument = (document) => {

    return {
        id: document.id,
        title: document.title,
        description: document.description,
        document_type: document.document_type,

        subject: {
            id: document.subject_id,
            name: document.subject_name,
            code: document.subject_code,
            level: document.subject_level,
            exam_board: document.subject_exam_board,
        },

        year: document.year,
        series: document.series,
        paper: document.paper,
        variant: document.variant,

        /*
        |--------------------------------------------------------------------------
        | GCS key remains internal.
        |--------------------------------------------------------------------------
        |
        | Do not expose the private storage object key unnecessarily.
        |
        */

        file_url: document.file_url,
        file_size_mb: document.file_size_mb,
        download_count: document.download_count,
        created_at: document.created_at,
    };
};


/*
|--------------------------------------------------------------------------
| JSON Field Parser
|--------------------------------------------------------------------------
*/

const parseJsonField = (value) => {

    if (!value) {
        return {};
    }

    if (typeof value === "object") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
};
