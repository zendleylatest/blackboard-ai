# Blackboard AI MySQL Database Audit Report

## 1. Overview
This audit compares the backend codebase models of Blackboard AI to the expected MySQL schema. Due to the local database environment returning `ECONNREFUSED` on port 3306, this audit relies entirely on static analysis of the Node.js source code (models, services, controllers) to extract all expected tables, columns, constraints, and relationships.

## 2. Tables Used by the Backend
The backend utilizes 34 `api_*` tables based on the executed queries. All of these have been included in the migration script.

- api_user
- api_userprofile
- api_pendinguser
- api_subject
- api_usersubject
- api_document
- api_studysession
- api_sessionquestion
- api_questionanswer
- api_questionanswerattachment
- api_questionevaluation
- api_questionchatmessage
- api_chatthread
- api_chatmessage
- api_chatattachment
- api_aicheckerevaluation
- api_flashcardset
- api_flashcard
- api_flashcardstudysession
- api_flashcardreviewevent
- api_usersubscription
- api_userusagelimit
- api_aiusagelog
- api_sessionquestionusage
- api_documentextractioncache
- api_quiz
- api_quizquestion
- api_quizattempt
- api_quizanswer
- api_devicetoken
- api_questionmapping
- api_mcqquiz
- api_mcqanswerkey
- api_ragchunk

## 3. Known Missing Tables & Columns
From previous issues encountered:
- `api_pendinguser` table was missing.
- Columns `google_id`, `apple_user_id`, `google_picture_url`, `auth_provider`, `profile_completed`, `otp_code`, `otp_expiry`, `last_login` in `api_user` were missing.
- `phone` in `api_userprofile` was missing.
- `gcs_key` in `api_document` was missing.

## 4. Potentially Dangerous Migrations
- **ALTER TABLE ADD COLUMN IF NOT EXISTS**: This syntax is supported natively in MariaDB 10.6+ and MySQL 8.0.16+. If the server runs an older version, these queries might result in a syntax error.
- **Constraints**: Since existing data might have violations (e.g. orphan records without a valid `user_id`), adding foreign keys via `ALTER TABLE` is omitted to prevent blocking the migration. Foreign keys are only included in the `CREATE TABLE` statements for tables that don't exist yet.

## 5. Migration Strategy
The generated `LOCAL_MYSQL_SCHEMA_MIGRATION.sql` script uses `CREATE TABLE IF NOT EXISTS` for all 34 tables. This ensures that any missing tables are safely created without dropping or modifying existing tables. It also uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for the known missing columns.

## 6. Uncertainties
- Because actual database inspection was impossible, some column types (like `TEXT` vs `VARCHAR`) are inferred based on standard usage (e.g., `sources` as JSON, `gcs_key` as `VARCHAR(500)`).
- If there are missing columns not previously identified, they will not be added automatically to existing tables, as I cannot diff them against the current schema.
