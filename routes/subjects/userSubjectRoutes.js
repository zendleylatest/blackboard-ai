import express from "express";

import {
    validate,
} from "../../middleware/validate.js";

import {
    authenticate,
} from "../../middleware/authMiddleware.js";

import {
    subjectIdValidation,
} from "../../validations/subjects/subjectValidation.js";

import {
    enrollSubjectController,
    unenrollSubjectController,
} from "../../controllers/subjects/userSubjectController.js";

const router = express.Router();

router.post(
    "/subjects/:subject_id/enroll",
    authenticate,
    subjectIdValidation,
    validate,
    enrollSubjectController
);

router.delete(
    "/subjects/:subject_id/unenroll",
    authenticate,
    subjectIdValidation,
    validate,
    unenrollSubjectController
);

export default router;
