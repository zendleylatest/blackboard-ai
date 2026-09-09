import { toFile } from "openai/uploads";
import HttpError from "../../utils/httpError.js";
import { getOpenAIClient, getOpenAIModel } from "../../utils/ai/openaiClient.js";
import { extractToolJson } from "../../utils/ai/llmHelpers.js";
import { evaluateAnswerWithAi } from "../aiChecker/aiCheckerAiService.js";
import { findQuestionMappingsByDocument } from "../../models/AiChecker.js";
import { readResourceFile } from "../../utils/localStorage.js";

const EXTRACTION_SCHEMA = {
    name: "return_extracted_questions",
    description: "Return every extracted question from a past paper",
    parameters: {
        type: "object",
        properties: {
            paper_title: { type: "string" },
            total_marks: { type: "number" },
            questions: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        question_number: { type: "string" },
                        question_part: { type: "string" },
                        question_subpart: { type: "string" },
                        question_text: { type: "string" },
                        marks_available: { type: "number" },
                        pdf_page_number: { type: "number" },
                        display_order: { type: "number" },
                    },
                    required: [
                        "question_number",
                        "question_text",
                        "marks_available",
                        "display_order",
                    ],
                },
            },
        },
        required: ["questions"],
    },
};

const FOLLOWUP_SCHEMA = {
    name: "return_chat_response",
    description: "Return a helpful follow-up tutoring response",
    parameters: {
        type: "object",
        properties: {
            response: { type: "string" },
            references_mark_scheme: { type: "boolean" },
        },
        required: ["response"],
    },
};

const downloadDocument = async (document) => {
    if (!document?.gcs_key) {
        throw new HttpError(503, "Document storage is not configured.");
    }
    return readResourceFile(document.gcs_key);
};

const uploadOpenAiFile = async (client, document) => {
    const buffer = await downloadDocument(document);
    const file = await client.files.create({
        file: await toFile(
            buffer,
            document.title || "document",
            { type: "application/pdf" }
        ),
        purpose: "user_data",
    });
    return file.id;
};

const fallbackQuestionsFromMappings = async (questionPaperId) => {
    const mappings = await findQuestionMappingsByDocument(questionPaperId);
    return mappings.map((mapping, index) => ({
        question_number: mapping.question_number || "",
        question_part: mapping.question_part || "",
        question_subpart: mapping.question_subpart || "",
        question_text: "",
        marks_available: Number(mapping.max_marks || 0),
        pdf_page_number: mapping.page_number,
        display_order: index + 1,
    }));
};

const questionRefKey = (question) => [
    question.question_number,
    question.question_part,
    question.question_subpart,
].map((value) => String(value || "").trim().toLowerCase()).join("|");

export const extractQuestionsFromDocuments = async ({
    questionPaper,
    markScheme,
}) => {
    const mappedQuestions = await fallbackQuestionsFromMappings(questionPaper.id);
    if (!process.env.OPENAI_API_KEY) {
        if (mappedQuestions.length > 0) {
            return {
                success: true,
                paper_title: questionPaper.title,
                total_marks: mappedQuestions.reduce(
                    (total, question) => total + question.marks_available,
                    0
                ),
                questions: mappedQuestions,
                question_count: mappedQuestions.length,
                processing_time_seconds: 0,
                extraction_model: "question-mappings",
            };
        }
        throw new HttpError(503, "Study-session AI extraction is not configured.");
    }
    const client = getOpenAIClient();
    let questionPaperFile;
    let markSchemeFile;
    try {
        questionPaperFile = await uploadOpenAiFile(client, questionPaper);
        markSchemeFile = await uploadOpenAiFile(client, markScheme);
        const startedAt = Date.now();
        const response = await client.responses.create({
            model: getOpenAIModel(),
            tools: [{
                type: "function",
                name: EXTRACTION_SCHEMA.name,
                description: EXTRACTION_SCHEMA.description,
                parameters: EXTRACTION_SCHEMA.parameters,
            }],
            tool_choice: {
                type: "function",
                name: EXTRACTION_SCHEMA.name,
            },
            input: [
                {
                    role: "system",
                    content: [{
                        type: "input_text",
                        text: "Extract every question, part, and subpart from the question paper. Use the mark scheme to verify marks. Preserve exact text and return all questions through the provided function.",
                    }],
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `Paper: ${questionPaper.title}\nSubject: ${questionPaper.subject_code || ""}`,
                        },
                        { type: "input_text", text: "QUESTION PAPER:" },
                        { type: "input_file", file_id: questionPaperFile },
                        { type: "input_text", text: "MARK SCHEME:" },
                        { type: "input_file", file_id: markSchemeFile },
                    ],
                },
            ],
            temperature: 0.1,
            max_output_tokens: Number(
                process.env.OPENAI_EXTRACTION_MAX_OUTPUT_TOKENS ||
                    16000
            ),
        });
        const payload = extractToolJson(response, EXTRACTION_SCHEMA.name);
        const questions = Array.isArray(payload?.questions)
            ? payload.questions.map((question, index) => ({
                question_number: String(question.question_number || ""),
                question_part: String(question.question_part || ""),
                question_subpart: String(question.question_subpart || ""),
                question_text: String(question.question_text || ""),
                marks_available: Number(question.marks_available || 0),
                pdf_page_number: question.pdf_page_number ?? null,
                display_order: Number(question.display_order || index + 1),
            })).filter((question) => question.question_number)
            : [];
        if (mappedQuestions.length > questions.length) {
            const seen = new Set(questions.map(questionRefKey));
            for (const mappedQuestion of mappedQuestions) {
                const key = questionRefKey(mappedQuestion);
                if (seen.has(key)) {
                    continue;
                }
                questions.push({
                    ...mappedQuestion,
                    display_order: questions.length + 1,
                });
                seen.add(key);
            }
        }
        questions.sort(
            (left, right) =>
                Number(left.display_order || 0) -
                Number(right.display_order || 0)
        );
        if (questions.length === 0) {
            throw new HttpError(502, "No questions were extracted from the paper.");
        }
        return {
            success: true,
            paper_title: payload.paper_title || questionPaper.title,
            total_marks: Number(payload.total_marks || questions.reduce(
                (total, question) => total + question.marks_available,
                0
            )),
            questions,
            question_count: questions.length,
            processing_time_seconds: Math.round((Date.now() - startedAt) / 1000),
            extraction_model: getOpenAIModel(),
        };
    } finally {
        for (const fileId of [questionPaperFile, markSchemeFile]) {
            if (fileId) {
                try {
                    await client.files.delete(fileId);
                } catch {
                    // Cleanup is best effort.
                }
            }
        }
    }
};

export const evaluateStudyQuestion = async ({
    questionText,
    questionNumber,
    questionPart,
    questionSubpart,
    marksAvailable,
    studentAnswer,
    markSchemeText,
    subjectCode,
    sourceDocuments = [],
}) => evaluateAnswerWithAi({
    question: `${questionNumber ? `Question ${questionNumber}` : ""}${questionPart ? `(${questionPart})` : ""}${questionSubpart ? `(${questionSubpart})` : ""}\n${questionText}`,
    studentAnswer,
    subjectCode,
    markSchemeText,
    maxMarks: marksAvailable,
    sourceDocuments,
});

export const generateStudyFollowup = async ({
    questionRef,
    questionText,
    studentAnswer,
    evaluationFeedback,
    chatHistory,
    userMessage,
    markSchemeText = "",
}) => {
    if (!process.env.OPENAI_API_KEY) {
        throw new HttpError(503, "Study-session AI chat is not configured.");
    }
    const client = getOpenAIClient();
    const history = (chatHistory || [])
        .slice(-10)
        .filter((message) => ["user", "assistant"].includes(message.role))
        .map((message) => ({
            role: message.role,
            content: message.text,
        }));
    const response = await client.responses.create({
        model: getOpenAIModel(),
        tools: [{
            type: "function",
            name: FOLLOWUP_SCHEMA.name,
            description: FOLLOWUP_SCHEMA.description,
            parameters: FOLLOWUP_SCHEMA.parameters,
        }],
        tool_choice: {
            type: "function",
            name: FOLLOWUP_SCHEMA.name,
        },
        input: [
            {
                role: "system",
                content: [{
                    type: "input_text",
                    text: `You are an expert tutor helping a student understand ${questionRef}. Explain clearly and reference the mark scheme when relevant.`,
                }],
            },
            ...history.map((message) => ({
                role: message.role,
                content: [{
                    type: message.role === "assistant" ? "output_text" : "input_text",
                    text: message.content,
                }],
            })),
            {
                role: "user",
                content: [{
                    type: "input_text",
                    text: [
                        `Question: ${questionRef}\n${questionText}`,
                        `Student answer:\n${studentAnswer || "(none)"}`,
                        `Evaluation feedback:\n${evaluationFeedback || "(none)"}`,
                        markSchemeText ? `Mark scheme:\n${markSchemeText}` : "",
                        `Follow-up question:\n${userMessage}`,
                    ].filter(Boolean).join("\n\n"),
                }],
            },
        ],
        temperature: 0.3,
        max_output_tokens: 2048,
    });
    const payload = extractToolJson(response, FOLLOWUP_SCHEMA.name);
    const answer = String(
        payload?.response ||
        response.output_text ||
        "I couldn't generate a response right now."
    ).trim();
    return {
        success: true,
        response: answer,
        references_mark_scheme: Boolean(payload?.references_mark_scheme),
        processing_time_seconds: 0,
    };
};
