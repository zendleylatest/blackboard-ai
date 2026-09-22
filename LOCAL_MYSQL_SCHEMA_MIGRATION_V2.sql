-- ============================================
-- V2 MIGRATION SCRIPT
-- ============================================

CREATE TABLE IF NOT EXISTS api_studysession (
  id char(32) PRIMARY KEY,
  created_at datetime(6),
  subject_id bigint,
  thread_id char(32),
  role varchar(50),
  mode varchar(50),
  user_id bigint,
  started_at datetime(6),
  quiz_id char(32),
  title varchar(255),
  status varchar(50),
  questions_data json,
  questions_answered int,
  total_questions int,
  total_marks_available int,
  total_marks_earned int,
  updated_at datetime(6),
  completed_at datetime(6),
  question_paper_id bigint,
  mark_scheme_id bigint,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_sessionquestion (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  question_number varchar(50),
  question_part varchar(50),
  question_subpart varchar(50),
  question_text longtext,
  marks_available int,
  pdf_page_number int,
  display_order int,
  created_at datetime(6),
  session_id char(32),
  user_id bigint,
  session_question_id bigint,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_questionanswer (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  session_question_id bigint,
  revision_number int,
  answer_id bigint,
  is_latest tinyint(1),
  submitted_at datetime(6),
  questions_answered int,
  total_marks_earned int,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_questionanswerattachment (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  session_question_id bigint,
  revision_number int,
  answer_id bigint,
  kind varchar(50),
  gcs_key varchar(500),
  original_filename varchar(255),
  size_bytes bigint,
  created_at datetime(6),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_questionevaluation (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  answer_id bigint,
  session_question_id bigint,
  feedback longtext,
  marks_awarded double,
  max_marks double,
  percentage double,
  marking_breakdown json,
  mark_scheme_text longtext,
  question_text longtext,
  model_used varchar(100),
  evaluation_time_seconds double,
  tokens_used int,
  evaluated_at datetime(6),
  questions_answered int,
  total_marks_earned int,
  status varchar(50),
  completed_at datetime(6),
  updated_at datetime(6),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_questionchatmessage (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  answer_id bigint,
  session_question_id bigint,
  session_id char(32),
  role varchar(50),
  text longtext,
  sources json,
  created_at datetime(6),
  related_answer_id bigint,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_chatthread (
  id char(32) PRIMARY KEY,
  updated_at datetime(6),
  subject_id bigint,
  user_id bigint,
  is_active tinyint(1),
  title varchar(255),
  created_at datetime(6),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_chatmessage (
  id char(32) PRIMARY KEY,
  created_at datetime(6),
  subject_id bigint,
  thread_id char(32),
  role varchar(50),
  mode varchar(50),
  question_paper_id bigint,
  user_id bigint,
  started_at datetime(6),
  submitted_at datetime(6),
  text longtext,
  tokens_in int,
  tokens_out int,
  model_name varchar(100),
  chunk_ids json,
  sources json,
  metadata json,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_chatattachment (
  id char(32) PRIMARY KEY,
  message_id char(32),
  thread_id char(32),
  uploader_id bigint,
  original_filename varchar(255),
  mime varchar(100),
  size_bytes bigint,
  kind varchar(50),
  status varchar(50),
  openai_file_id varchar(100),
  gcs_key varchar(500),
  preview_url longtext,
  created_at datetime(6),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_aicheckerevaluation (
  id char(32) PRIMARY KEY,
  feedback longtext,
  strengths json,
  improvements json,
  mode varchar(50),
  question_text longtext,
  student_answer longtext,
  question_number varchar(50),
  question_part varchar(50),
  question_subpart varchar(50),
  marks_awarded double,
  max_marks double,
  marking_rubric json,
  model_used varchar(100),
  evaluation_time_seconds double,
  created_at datetime(6),
  message_id char(32),
  question_paper_id bigint,
  thread_id char(32),
  title varchar(255),
  user_id bigint,
  role varchar(50),
  subject_id bigint,
  started_at datetime(6),
  session_id char(32),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_usersubscription (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  tier varchar(50),
  user_id bigint,
  is_active tinyint(1),
  revenuecat_app_user_id varchar(255),
  store varchar(50),
  product_id varchar(255),
  expires_at datetime(6),
  original_purchase_date datetime(6),
  cancellation_date datetime(6),
  last_webhook_event datetime(6),
  created_at datetime(6),
  updated_at datetime(6),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_userusagelimit (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  user_id bigint,
  flashcard_sets_created int,
  quizzes_created int,
  ai_checker_uses int,
  past_paper_questions_used int,
  study_sessions_created int,
  chat_messages_sent int,
  mcq_wrong_reviews_used int,
  current_week_end datetime(6),
  created_at datetime(6),
  updated_at datetime(6),
  tier varchar(50),
  feature varchar(100),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_aiusagelog (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  feature varchar(100),
  user_id bigint,
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  estimated_cost_usd double,
  created_at datetime(6),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_sessionquestionusage (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  tier varchar(50),
  answer_revisions int,
  followup_messages int,
  session_question_id bigint,
  created_at datetime(6),
  updated_at datetime(6),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_documentextractioncache (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  extraction_data json,
  extraction_model varchar(100),
  processing_time_seconds double,
  question_paper_id bigint,
  mark_scheme_id bigint,
  created_at datetime(6),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_devicetoken (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  token varchar(255),
  platform varchar(50),
  user_id bigint,
  is_active tinyint(1),
  created_at datetime(6),
  updated_at datetime(6),
  tier varchar(50),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_questionmapping (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  document_id bigint,
  question_number varchar(50),
  question_part varchar(50),
  question_subpart varchar(50),
  mark_scheme_text longtext,
  max_marks double,
  created_at datetime(6),
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_mcqanswerkey (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  total_questions int,
  metadata json,
  updated_at datetime(6),
  mark_scheme_id bigint,
  question_paper_id bigint,
  subject_id bigint,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_ragchunk (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  title varchar(255),
  subject_id bigint,
  created_at datetime(6) DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Missing columns from V1
ALTER TABLE api_flashcardset ADD COLUMN IF NOT EXISTS sources JSON;
ALTER TABLE api_flashcard ADD COLUMN IF NOT EXISTS sources JSON;
ALTER TABLE api_quiz ADD COLUMN IF NOT EXISTS sources JSON;
ALTER TABLE api_quizquestion ADD COLUMN IF NOT EXISTS sources JSON;
ALTER TABLE api_quizattempt ADD COLUMN IF NOT EXISTS completed_at DATETIME(6);
