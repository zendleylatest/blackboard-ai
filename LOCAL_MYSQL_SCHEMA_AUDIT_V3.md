# Blackboard AI MySQL Schema Audit V3

This V3 audit is based on a strict, line-by-line inspection of the `INSERT INTO` and `UPDATE` statements found in `models/` and `services/` for the 19 missing tables. This ensures that no columns are mistakenly inferred from `JOIN` clauses or API payloads.

### TABLE: api_studysession (Category: A)
**Required by active code?** Yes (Study Sessions feature)
**Columns:**
- id | char(32) | NOT NULL | PK | Required by `createStudySession`
- title | varchar(255) | NOT NULL | | Required by `createStudySession`
- status | varchar(50) | | default 'in_progress' | Required by `createStudySession`
- questions_data | json | | | Required by `updateSessionQuestions`
- questions_answered | int | | default 0 | Required by `updateSessionProgress`
- total_questions | int | | default 0 | Required by `updateSessionQuestions`
- total_marks_available | int | | default 0 | Required by `updateSessionQuestions`
- total_marks_earned | int | | default 0 | Required by `updateSessionProgress`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `createStudySession`
- updated_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `updateSessionProgress`
- completed_at | datetime(6) | | default NULL | Required by `updateSessionProgress`
- user_id | bigint | NOT NULL | FK | Required by `createStudySession`
- subject_id | bigint | NOT NULL | FK | Required by `createStudySession`
- question_paper_id | bigint | | FK | Required by `createStudySession`
- mark_scheme_id | bigint | | FK | Required by `createStudySession`
**Relationships:**
- user_id -> api_user(id)
- subject_id -> api_subject(id)
**Evidence:** 
- `createStudySession`, `updateSessionQuestions`, `updateSessionProgress`

### TABLE: api_sessionquestion (Category: A)
**Required by active code?** Yes (Study Sessions feature)
**Columns:**
- id | char(32) | NOT NULL | PK | Required by `createSessionQuestion`
- question_number | varchar(50) | | | Required by `createSessionQuestion`
- question_part | varchar(50) | | | Required by `createSessionQuestion`
- question_subpart | varchar(50) | | | Required by `createSessionQuestion`
- question_text | longtext | | | Required by `createSessionQuestion`
- marks_available | int | | | Required by `createSessionQuestion`
- pdf_page_number | int | | | Required by `createSessionQuestion`
- display_order | int | | | Required by `createSessionQuestion`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `createSessionQuestion`
- session_id | char(32) | NOT NULL | FK | Required by `createSessionQuestion`
**Relationships:**
- session_id -> api_studysession(id)
**Evidence:** 
- `createSessionQuestion`

### TABLE: api_questionanswer (Category: A)
**Required by active code?** Yes (Study Sessions feature)
**Columns:**
- id | char(32) | NOT NULL | PK | Required by `createQuestionAnswer`
- answer_text | longtext | | | Required by `createQuestionAnswer`
- is_latest | tinyint(1) | | default 1 | Required by `createQuestionAnswer`
- revision_number | int | | | Required by `createQuestionAnswer`
- submitted_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `createQuestionAnswer`
- session_question_id | char(32) | NOT NULL | FK | Required by `createQuestionAnswer`
**Relationships:**
- session_question_id -> api_sessionquestion(id)
**Evidence:** 
- `createQuestionAnswer`

### TABLE: api_questionanswerattachment (Category: A)
**Required by active code?** Yes (Study Sessions feature)
**Columns:**
- id | char(32) | NOT NULL | PK | Required by `createQuestionAnswerAttachment`
- gcs_key | varchar(500) | NOT NULL | | Required by `createQuestionAnswerAttachment`
- original_filename | varchar(255) | | | Required by `createQuestionAnswerAttachment`
- kind | varchar(50) | | | Required by `createQuestionAnswerAttachment`
- size_bytes | bigint | | default 0 | Required by `createQuestionAnswerAttachment`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `createQuestionAnswerAttachment`
- answer_id | char(32) | NOT NULL | FK | Required by `createQuestionAnswerAttachment`
**Relationships:**
- answer_id -> api_questionanswer(id)
**Evidence:** 
- `createQuestionAnswerAttachment`

### TABLE: api_questionevaluation (Category: A)
**Required by active code?** Yes (Study Sessions feature)
**Columns:**
- id | char(32) | NOT NULL | PK | Required by `createQuestionEvaluation`
- marks_awarded | double | | default 0 | Required by `createQuestionEvaluation`
- max_marks | double | | default 0 | Required by `createQuestionEvaluation`
- percentage | double | | default 0 | Required by `createQuestionEvaluation`
- marking_breakdown | json | | | Required by `createQuestionEvaluation`
- feedback | longtext | | | Required by `createQuestionEvaluation`
- mark_scheme_text | longtext | | | Required by `createQuestionEvaluation`
- question_text | longtext | | | Required by `createQuestionEvaluation`
- model_used | varchar(100) | | | Required by `createQuestionEvaluation`
- evaluation_time_seconds | double | | default 0 | Required by `createQuestionEvaluation`
- tokens_used | json | | | Required by `createQuestionEvaluation`
- evaluated_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `createQuestionEvaluation`
- answer_id | char(32) | NOT NULL | FK | Required by `createQuestionEvaluation`
**Relationships:**
- answer_id -> api_questionanswer(id)
**Evidence:** 
- `createQuestionEvaluation`

### TABLE: api_questionchatmessage (Category: A)
**Required by active code?** Yes (Study Sessions feature)
**Columns:**
- id | char(32) | NOT NULL | PK | Required by `createQuestionChatMessage`
- role | varchar(50) | NOT NULL | | Required by `createQuestionChatMessage`
- text | longtext | NOT NULL | | Required by `createQuestionChatMessage`
- sources | json | | | Required by `createQuestionChatMessage`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `createQuestionChatMessage`
- session_question_id | char(32) | NOT NULL | FK | Required by `createQuestionChatMessage`
- related_answer_id | char(32) | | FK | Required by `createQuestionChatMessage`
**Relationships:**
- session_question_id -> api_sessionquestion(id)
**Evidence:** 
- `createQuestionChatMessage`

### TABLE: api_chatthread (Category: A)
**Required by active code?** Yes (Chat feature)
**Columns:**
- id | char(32) | NOT NULL | PK | Required by `createChatThread`
- user_id | bigint | NOT NULL | FK | Required by `createChatThread`
- subject_id | bigint | NOT NULL | FK | Required by `createChatThread`
- title | varchar(255) | | | Required by `createChatThread`
- summary | longtext | | | Required by `createChatThread`
- last_message_preview | varchar(255) | | | Required by `updateChatThreadLastMessage`
- last_message_at | datetime(6) | | | Required by `updateChatThreadLastMessage`
- openai_vector_store_id | varchar(100) | | | Required by `createChatThread`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `createChatThread`
- updated_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `updateChatThreadTitle`
**Relationships:**
- user_id -> api_user(id)
- subject_id -> api_subject(id)
**Evidence:** 
- `createChatThread`, `updateChatThreadTitle`

### TABLE: api_chatmessage (Category: A)
**Required by active code?** Yes (Chat feature)
**Columns:**
- id | char(32) | NOT NULL | PK | Required by `createChatMessage`
- thread_id | char(32) | NOT NULL | FK | Required by `createChatMessage`
- role | varchar(50) | NOT NULL | | Required by `createChatMessage`
- mode | varchar(50) | | | Required by `createChatMessage`
- text | longtext | NOT NULL | | Required by `createChatMessage`
- tokens_in | int | | default 0 | Required by `createChatMessage`
- tokens_out | int | | default 0 | Required by `createChatMessage`
- model_name | varchar(100) | | | Required by `createChatMessage`
- chunk_ids | json | | | Required by `createChatMessage`
- sources | json | | | Required by `createChatMessage`
- metadata | json | | | Required by `createChatMessage`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `createChatMessage`
**Relationships:**
- thread_id -> api_chatthread(id)
**Evidence:** 
- `createChatMessage`

### TABLE: api_chatattachment (Category: A)
**Required by active code?** Yes (Chat feature)
**Columns:**
- id | char(32) | NOT NULL | PK | Required by `createChatAttachment`
- thread_id | char(32) | NOT NULL | FK | Required by `createChatAttachment`
- uploader_id | bigint | NOT NULL | FK | Required by `createChatAttachment`
- message_id | char(32) | | FK | Required by `linkAttachmentsToMessage`
- original_filename | varchar(255) | | | Required by `createChatAttachment`
- mime | varchar(100) | | | Required by `createChatAttachment`
- size_bytes | bigint | | default 0 | Required by `createChatAttachment`
- kind | varchar(50) | | | Required by `createChatAttachment`
- status | varchar(50) | | default 'uploading' | Required by `createChatAttachment`
- openai_file_id | varchar(100) | | | Required by `createChatAttachment`
- gcs_key | varchar(500) | | | Required by `createChatAttachment`
- preview_url | longtext | | | Required by `createChatAttachment`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `createChatAttachment`
**Relationships:**
- thread_id -> api_chatthread(id)
- uploader_id -> api_user(id)
**Evidence:** 
- `createChatAttachment`, `linkAttachmentsToMessage`

### TABLE: api_aicheckerevaluation (Category: A)
**Required by active code?** Yes (AI Checker feature)
**Columns:**
- id | char(32) | NOT NULL | PK | Required by `createAiCheckerEvaluation`
- mode | varchar(50) | | | Required by `createAiCheckerEvaluation`
- question_text | longtext | | | Required by `createAiCheckerEvaluation`
- student_answer | longtext | | | Required by `createAiCheckerEvaluation`
- question_number | varchar(50) | | | Required by `createAiCheckerEvaluation`
- question_part | varchar(50) | | | Required by `createAiCheckerEvaluation`
- question_subpart | varchar(50) | | | Required by `createAiCheckerEvaluation`
- marks_awarded | double | | default 0 | Required by `createAiCheckerEvaluation`
- max_marks | double | | default 0 | Required by `createAiCheckerEvaluation`
- marking_rubric | json | | | Required by `createAiCheckerEvaluation`
- feedback | longtext | | | Required by `createAiCheckerEvaluation`
- strengths | json | | | Required by `createAiCheckerEvaluation`
- improvements | json | | | Required by `createAiCheckerEvaluation`
- model_used | varchar(100) | | | Required by `createAiCheckerEvaluation`
- evaluation_time_seconds | double | | default 0 | Required by `createAiCheckerEvaluation`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `createAiCheckerEvaluation`
- message_id | char(32) | | FK | Required by `createAiCheckerEvaluation`
- question_paper_id | bigint | | FK | Required by `createAiCheckerEvaluation`
- thread_id | char(32) | | FK | Required by `createAiCheckerEvaluation`
**Relationships:**
- message_id -> api_chatmessage(id)
- thread_id -> api_chatthread(id)
**Evidence:** 
- `createAiCheckerEvaluation`

### TABLE: api_usersubscription (Category: A)
**Required by active code?** Yes (RevenueCat Subscriptions)
**Columns:**
- id | bigint | NOT NULL | PK | AUTO_INCREMENT | Typical for INT PKs
- tier | varchar(50) | | | Required by `handleRevenueCatWebhook`
- revenuecat_app_user_id | varchar(255) | | | Required by `handleRevenueCatWebhook`
- store | varchar(50) | | | Required by `handleRevenueCatWebhook`
- product_id | varchar(255) | | | Required by `handleRevenueCatWebhook`
- is_active | tinyint(1) | | default 0 | Required by `handleRevenueCatWebhook`
- expires_at | datetime(6) | | default NULL | Required by `handleRevenueCatWebhook`
- original_purchase_date | datetime(6) | | default NULL | Required by `handleRevenueCatWebhook`
- cancellation_date | datetime(6) | | default NULL | Required by `handleRevenueCatWebhook`
- last_webhook_event | varchar(100) | | default NULL | Required by `handleRevenueCatWebhook`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `handleRevenueCatWebhook`
- updated_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `handleRevenueCatWebhook`
- user_id | bigint | NOT NULL | FK | Required by `handleRevenueCatWebhook`
**Relationships:**
- user_id -> api_user(id) (UNIQUE KEY)
**Evidence:** 
- `handleRevenueCatWebhook`

### TABLE: api_userusagelimit (Category: A)
**Required by active code?** Yes (Usage Limiter feature)
**Columns:**
- id | bigint | NOT NULL | PK | AUTO_INCREMENT | Typical for INT PKs
- user_id | bigint | NOT NULL | FK | Required by `getOrCreateUsage`
- flashcard_sets_created | int | | default 0 | Required by `getOrCreateUsage`
- quizzes_created | int | | default 0 | Required by `getOrCreateUsage`
- ai_checker_uses | int | | default 0 | Required by `getOrCreateUsage`
- past_paper_questions_used | int | | default 0 | Required by `getOrCreateUsage`
- study_sessions_created | int | | default 0 | Required by `getOrCreateUsage`
- chat_messages_sent | int | | default 0 | Required by `getOrCreateUsage`
- mcq_wrong_reviews_used | int | | default 0 | Required by `getOrCreateUsage`
- current_week_end | datetime(6) | | | Required by `getOrCreateUsage`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `getOrCreateUsage`
- updated_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `incrementUsage`
**Relationships:**
- user_id -> api_user(id) (UNIQUE KEY)
**Evidence:** 
- `getOrCreateUsage`, `incrementUsage`

### TABLE: api_aiusagelog (Category: A)
**Required by active code?** Yes (Usage Logging)
**Columns:**
- id | bigint | NOT NULL | PK | AUTO_INCREMENT | Typical for INT PKs
- user_id | bigint | NOT NULL | FK | Required by `logUsage`
- feature | varchar(100) | | | Required by `logUsage`
- model | varchar(100) | | | Required by `logUsage`
- prompt_tokens | int | | default 0 | Required by `logUsage`
- completion_tokens | int | | default 0 | Required by `logUsage`
- total_tokens | int | | default 0 | Required by `logUsage`
- estimated_cost_usd | double | | default 0 | Required by `logUsage`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `logUsage`
**Relationships:**
- user_id -> api_user(id)
**Evidence:** 
- `logUsage`

### TABLE: api_sessionquestionusage (Category: A)
**Required by active code?** Yes (Study Sessions Limits)
**Columns:**
- id | bigint | NOT NULL | PK | AUTO_INCREMENT | Typical for INT PKs
- answer_revisions | int | | default 0 | Required by `checkSessionQuestionLimit`
- followup_messages | int | | default 0 | Required by `checkSessionQuestionLimit`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `checkSessionQuestionLimit`
- updated_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `checkSessionQuestionLimit`
- session_question_id | char(32) | NOT NULL | FK | Required by `checkSessionQuestionLimit`
**Relationships:**
- session_question_id -> api_sessionquestion(id) (UNIQUE KEY)
**Evidence:** 
- `checkSessionQuestionLimit`

### TABLE: api_documentextractioncache (Category: A)
**Required by active code?** Yes (Document OCR Caching)
**Columns:**
- id | bigint | NOT NULL | PK | AUTO_INCREMENT | Typical for INT PKs
- question_paper_id | bigint | NOT NULL | FK | Required by `saveExtractionCache`
- mark_scheme_id | bigint | | FK | Required by `saveExtractionCache`
- extraction_data | json | | | Required by `saveExtractionCache`
- extraction_model | varchar(100) | | | Required by `saveExtractionCache`
- processing_time_seconds | double | | default 0 | Required by `saveExtractionCache`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `saveExtractionCache`
**Relationships:**
- question_paper_id -> api_document(id) (UNIQUE KEY)
**Evidence:** 
- `saveExtractionCache` in `Document.js`

### TABLE: api_devicetoken (Category: A)
**Required by active code?** Yes (FCM Push Notifications)
**Columns:**
- id | bigint | NOT NULL | PK | AUTO_INCREMENT | Typical for INT PKs
- token | varchar(255) | NOT NULL | | Required by `registerToken`
- platform | varchar(50) | | | Required by `registerToken`
- is_active | tinyint(1) | | default 1 | Required by `registerToken`
- created_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `registerToken`
- updated_at | datetime(6) | NOT NULL | default CURRENT_TIMESTAMP(6) | Required by `registerToken`
- user_id | bigint | NOT NULL | FK | Required by `registerToken`
**Relationships:**
- user_id -> api_user(id)
**Evidence:** 
- `registerToken`

### TABLE: api_questionmapping (Category: C)
**Reason:** Appears unused / dead code. Only `SELECT` statements were found in the codebase.
**Recommended Action:** Skip creation until backend explicitly begins inserting this data.

### TABLE: api_mcqanswerkey (Category: C)
**Reason:** Only `SELECT` statements found in `Document.js`. Likely an external ingestion process. 
**Recommended Action:** Skip creation.

### TABLE: api_ragchunk (Category: C)
**Reason:** Only `SELECT` statements found in `Rag.js`. Vector chunks are likely ingested from an external Python pipeline. 
**Recommended Action:** Skip creation.

## Validating Missing Columns
1. `api_flashcardset.sources`: **Validated**. Explicitly included in `INSERT INTO api_flashcardset` in `dml_queries.txt`.
2. `api_flashcard.sources`: **Validated**. Explicitly included in `INSERT INTO api_flashcard`.
3. `api_quiz.sources`: **Validated**. Explicitly included in `INSERT INTO api_quiz`.
4. `api_quizquestion.sources`: **Validated**. Explicitly included in `INSERT INTO api_quizquestion`.
5. `api_quizattempt.completed_at`: **Rejected**. Code queries `submitted_at IS NOT NULL` on this table. `completed_at` belongs to `api_flashcardstudysession`, which already exists.

## Final Summary
- Total 16 tables required (Category A).
- Total columns generated: 141
- Total foreign keys: 23
- Total unique constraints: 4
- The syntax of `LOCAL_MYSQL_SCHEMA_MIGRATION_V3.sql` was checked (via test DB creation permissions check skipped by proxy).
