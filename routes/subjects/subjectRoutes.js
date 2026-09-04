import express from "express";

import {
    getSubjectsController,
    enrollSubjectController,
    unenrollSubjectController,
} from "../../controllers/subjects/subjectController.js";

import {
    subjectListValidation,
    subjectIdValidation,
} from "../../validations/subjects/subjectValidation.js";

import { validate } from "../../middleware/validate.js";
import {
    authenticate,
    optionalAuthenticate,
} from "../../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Subject Routes
|--------------------------------------------------------------------------
*/

// GET /subjects/
router.get(
    "/",
    optionalAuthenticate,
    subjectListValidation,
    validate,
    getSubjectsController
);

// POST /subjects/:subject_id/enroll/
router.post(
    "/:subject_id/enroll/",
    authenticate,
    subjectIdValidation,
    validate,
    enrollSubjectController
);

// DELETE /subjects/:subject_id/unenroll/
router.delete(
    "/:subject_id/unenroll/",
    authenticate,
    subjectIdValidation,
    validate,
    unenrollSubjectController
);

export default router;
