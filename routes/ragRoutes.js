import express from "express";
import {
    ragTestController,
    ragRetrieveController,
} from "../controllers/ragController.js";
import { ragRetrieveValidation } from "../validations/ragValidation.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.get("/rag/test/", ragTestController);
router.post("/rag/retrieve/", authenticate, ragRetrieveValidation, validate, ragRetrieveController);

export default router;
