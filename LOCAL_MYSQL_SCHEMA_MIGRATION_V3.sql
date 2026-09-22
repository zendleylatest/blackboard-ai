-- ============================================
-- LOCAL_MYSQL_SCHEMA_MIGRATION_V3.sql
-- ============================================

CREATE TABLE IF NOT EXISTS api_studysession (
  id char(32),
  title varchar(255),
  status varchar(50) DEFAULT 'in_progress',
  questions_data json,
  questions_answered int DEFAULT 0,
  total_questions int DEFAULT 0,
  total_marks_available int DEFAULT 0,
  total_marks_earned int DEFAULT 0,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  completed_at datetime(6) DEFAULT NULL,
  user_id bigint,
  subject_id bigint,
  question_paper_id bigint,
  mark_scheme_id bigint,
  PRIMARY KEY (id),
  CONSTRAINT fk_api_studysession_user_id FOREIGN KEY (user_id) REFERENCES api_user (id) ON DELETE CASCADE,
  CONSTRAINT fk_api_studysession_subject_id FOREIGN KEY (subject_id) REFERENCES api_subject (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_sessionquestion (
  id char(32),
  question_number varchar(50),
  question_part varchar(50),
  question_subpart varchar(50),
  question_text longtext,
  marks_available int,
  pdf_page_number int,
  display_order int,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  session_id char(32),
  PRIMARY KEY (id),
  CONSTRAINT fk_api_sessionquestion_session_id FOREIGN KEY (session_id) REFERENCES api_studysession (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_questionanswer (
  id char(32),
  answer_text longtext,
  is_latest tinyint(1) DEFAULT 1,
  revision_number int,
  submitted_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  session_question_id char(32),
  PRIMARY KEY (id),
  CONSTRAINT fk_api_questionanswer_session_question_id FOREIGN KEY (session_question_id) REFERENCES api_sessionquestion (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_questionanswerattachment (
  id char(32),
  gcs_key varchar(500),
  original_filename varchar(255),
  kind varchar(50),
  size_bytes bigint,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  answer_id char(32),
  PRIMARY KEY (id),
  CONSTRAINT fk_api_questionanswerattachment_answer_id FOREIGN KEY (answer_id) REFERENCES api_questionanswer (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_questionevaluation (
  id char(32),
  marks_awarded double,
  max_marks double,
  percentage double,
  marking_breakdown json,
  feedback longtext,
  mark_scheme_text longtext,
  question_text longtext,
  model_used varchar(100),
  evaluation_time_seconds double,
  tokens_used json,
  evaluated_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  answer_id char(32),
  PRIMARY KEY (id),
  CONSTRAINT fk_api_questionevaluation_answer_id FOREIGN KEY (answer_id) REFERENCES api_questionanswer (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_questionchatmessage (
  id char(32),
  role varchar(50),
  text longtext,
  sources json,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  session_question_id char(32),
  related_answer_id char(32) DEFAULT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_api_questionchatmessage_session_question_id FOREIGN KEY (session_question_id) REFERENCES api_sessionquestion (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_chatthread (
  id char(32),
  user_id bigint,
  subject_id bigint,
  title varchar(255),
  summary longtext,
  last_message_preview varchar(255),
  last_message_at datetime(6) DEFAULT NULL,
  openai_vector_store_id varchar(100),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_api_chatthread_user_id FOREIGN KEY (user_id) REFERENCES api_user (id) ON DELETE CASCADE,
  CONSTRAINT fk_api_chatthread_subject_id FOREIGN KEY (subject_id) REFERENCES api_subject (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_chatmessage (
  id char(32),
  thread_id char(32),
  role varchar(50),
  mode varchar(50),
  text longtext,
  tokens_in int DEFAULT 0,
  tokens_out int DEFAULT 0,
  model_name varchar(100),
  chunk_ids json,
  sources json,
  metadata json,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_api_chatmessage_thread_id FOREIGN KEY (thread_id) REFERENCES api_chatthread (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_chatattachment (
  id char(32),
  thread_id char(32),
  uploader_id bigint,
  message_id char(32) DEFAULT NULL,
  original_filename varchar(255),
  mime varchar(100),
  size_bytes bigint,
  kind varchar(50),
  status varchar(50),
  openai_file_id varchar(100),
  gcs_key varchar(500),
  preview_url longtext,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_api_chatattachment_thread_id FOREIGN KEY (thread_id) REFERENCES api_chatthread (id) ON DELETE CASCADE,
  CONSTRAINT fk_api_chatattachment_uploader_id FOREIGN KEY (uploader_id) REFERENCES api_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_aicheckerevaluation (
  id char(32),
  mode varchar(50),
  question_text longtext,
  student_answer longtext,
  question_number varchar(50),
  question_part varchar(50),
  question_subpart varchar(50),
  marks_awarded double,
  max_marks double,
  marking_rubric json,
  feedback longtext,
  strengths json,
  improvements json,
  model_used varchar(100),
  evaluation_time_seconds double,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  message_id char(32),
  question_paper_id bigint,
  thread_id char(32),
  PRIMARY KEY (id),
  CONSTRAINT fk_api_aicheckerevaluation_message_id FOREIGN KEY (message_id) REFERENCES api_chatmessage (id) ON DELETE CASCADE,
  CONSTRAINT fk_api_aicheckerevaluation_thread_id FOREIGN KEY (thread_id) REFERENCES api_chatthread (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_usersubscription (
  id bigint AUTO_INCREMENT,
  tier varchar(50),
  revenuecat_app_user_id varchar(255),
  store varchar(50),
  product_id varchar(255),
  is_active tinyint(1) DEFAULT 0,
  expires_at datetime(6) DEFAULT NULL,
  original_purchase_date datetime(6) DEFAULT NULL,
  cancellation_date datetime(6) DEFAULT NULL,
  last_webhook_event varchar(100) DEFAULT NULL,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  user_id bigint,
  PRIMARY KEY (id),
  UNIQUE KEY api_usersubscription_user_id_uq (user_id),
  CONSTRAINT fk_api_usersubscription_user_id FOREIGN KEY (user_id) REFERENCES api_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_userusagelimit (
  id bigint AUTO_INCREMENT,
  user_id bigint,
  flashcard_sets_created int DEFAULT 0,
  quizzes_created int DEFAULT 0,
  ai_checker_uses int DEFAULT 0,
  past_paper_questions_used int DEFAULT 0,
  study_sessions_created int DEFAULT 0,
  chat_messages_sent int DEFAULT 0,
  mcq_wrong_reviews_used int DEFAULT 0,
  current_week_end datetime(6),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY api_userusagelimit_user_id_uq (user_id),
  CONSTRAINT fk_api_userusagelimit_user_id FOREIGN KEY (user_id) REFERENCES api_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_aiusagelog (
  id bigint AUTO_INCREMENT,
  user_id bigint,
  feature varchar(100),
  model varchar(100),
  prompt_tokens int DEFAULT 0,
  completion_tokens int DEFAULT 0,
  total_tokens int DEFAULT 0,
  estimated_cost_usd double DEFAULT 0,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_api_aiusagelog_user_id FOREIGN KEY (user_id) REFERENCES api_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_sessionquestionusage (
  id bigint AUTO_INCREMENT,
  answer_revisions int DEFAULT 0,
  followup_messages int DEFAULT 0,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  session_question_id char(32),
  PRIMARY KEY (id),
  UNIQUE KEY api_sessionquestionusage_session_question_id_uq (session_question_id),
  CONSTRAINT fk_api_sessionquestionusage_session_question_id FOREIGN KEY (session_question_id) REFERENCES api_sessionquestion (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_documentextractioncache (
  id bigint AUTO_INCREMENT,
  question_paper_id bigint,
  mark_scheme_id bigint,
  extraction_data json,
  extraction_model varchar(100),
  processing_time_seconds double,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY api_documentextractioncache_question_paper_id_uq (question_paper_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_devicetoken (
  id bigint AUTO_INCREMENT,
  token varchar(255),
  platform varchar(50),
  is_active tinyint(1) DEFAULT 1,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  user_id bigint,
  PRIMARY KEY (id),
  UNIQUE KEY api_devicetoken_token_uq (token),
  CONSTRAINT fk_api_devicetoken_user_id FOREIGN KEY (user_id) REFERENCES api_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Existing Missing Columns
ALTER TABLE api_flashcardset ADD COLUMN IF NOT EXISTS sources JSON;
ALTER TABLE api_flashcard ADD COLUMN IF NOT EXISTS sources JSON;
ALTER TABLE api_quiz ADD COLUMN IF NOT EXISTS sources JSON;
ALTER TABLE api_quizquestion ADD COLUMN IF NOT EXISTS sources JSON;
