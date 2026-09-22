-- ============================================
-- LIVE DB MIGRATION: Blackboard AI
-- ============================================

-- Missing table api_studysession
CREATE TABLE IF NOT EXISTS api_studysession (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject_id INT NOT NULL,
    question_paper_id INT DEFAULT NULL,
    mark_scheme_id INT DEFAULT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'in_progress',
    questions_data JSON DEFAULT NULL,
    questions_answered INT DEFAULT 0,
    total_questions INT DEFAULT 0,
    total_marks_available INT DEFAULT 0,
    total_marks_earned INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES api_subject(id) ON DELETE CASCADE,
    FOREIGN KEY (question_paper_id) REFERENCES api_document(id) ON DELETE SET NULL,
    FOREIGN KEY (mark_scheme_id) REFERENCES api_document(id) ON DELETE SET NULL
);

-- Missing table api_sessionquestion
CREATE TABLE IF NOT EXISTS api_sessionquestion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    question_number VARCHAR(50) NOT NULL,
    question_part VARCHAR(50) DEFAULT NULL,
    question_subpart VARCHAR(50) DEFAULT NULL,
    question_text TEXT DEFAULT NULL,
    marks_available INT DEFAULT 0,
    pdf_page_number INT DEFAULT NULL,
    display_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES api_studysession(id) ON DELETE CASCADE
);

-- Missing table api_questionanswer
CREATE TABLE IF NOT EXISTS api_questionanswer (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_question_id INT NOT NULL,
    answer_text TEXT DEFAULT NULL,
    is_latest TINYINT(1) DEFAULT 1,
    revision_number INT DEFAULT 1,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_question_id) REFERENCES api_sessionquestion(id) ON DELETE CASCADE
);

-- Missing table api_questionanswerattachment
CREATE TABLE IF NOT EXISTS api_questionanswerattachment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    answer_id INT NOT NULL,
    gcs_key VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) DEFAULT NULL,
    kind VARCHAR(50) DEFAULT NULL,
    size_bytes INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (answer_id) REFERENCES api_questionanswer(id) ON DELETE CASCADE
);

-- Missing table api_questionevaluation
CREATE TABLE IF NOT EXISTS api_questionevaluation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    answer_id INT NOT NULL,
    marks_awarded INT DEFAULT 0,
    max_marks INT DEFAULT 0,
    percentage FLOAT DEFAULT 0,
    marking_breakdown JSON DEFAULT NULL,
    feedback TEXT DEFAULT NULL,
    mark_scheme_text TEXT DEFAULT NULL,
    question_text TEXT DEFAULT NULL,
    model_used VARCHAR(100) DEFAULT NULL,
    evaluation_time_seconds FLOAT DEFAULT 0,
    tokens_used INT DEFAULT 0,
    evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (answer_id) REFERENCES api_questionanswer(id) ON DELETE CASCADE
);

-- Missing table api_questionchatmessage
CREATE TABLE IF NOT EXISTS api_questionchatmessage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_question_id INT NOT NULL,
    related_answer_id INT DEFAULT NULL,
    role VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    sources JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_question_id) REFERENCES api_sessionquestion(id) ON DELETE CASCADE,
    FOREIGN KEY (related_answer_id) REFERENCES api_questionanswer(id) ON DELETE SET NULL
);

-- Missing table api_chatthread
CREATE TABLE IF NOT EXISTS api_chatthread (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject_id INT NOT NULL,
    title VARCHAR(255) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES api_subject(id) ON DELETE CASCADE
);

-- Missing table api_chatmessage
CREATE TABLE IF NOT EXISTS api_chatmessage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    thread_id INT NOT NULL,
    role VARCHAR(50) NOT NULL,
    mode VARCHAR(50) DEFAULT 'chat',
    text TEXT NOT NULL,
    tokens_in INT DEFAULT 0,
    tokens_out INT DEFAULT 0,
    model_name VARCHAR(100) DEFAULT NULL,
    chunk_ids JSON DEFAULT NULL,
    sources JSON DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES api_chatthread(id) ON DELETE CASCADE
);

-- Missing table api_chatattachment
CREATE TABLE IF NOT EXISTS api_chatattachment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    thread_id INT NOT NULL,
    uploader_id INT NOT NULL,
    original_filename VARCHAR(255) DEFAULT NULL,
    mime VARCHAR(100) DEFAULT NULL,
    size_bytes INT DEFAULT 0,
    kind VARCHAR(50) DEFAULT NULL,
    status VARCHAR(50) DEFAULT 'uploaded',
    openai_file_id VARCHAR(100) DEFAULT NULL,
    gcs_key VARCHAR(500) DEFAULT NULL,
    preview_url TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES api_chatthread(id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES api_user(id) ON DELETE CASCADE
);

-- Missing table api_aicheckerevaluation
CREATE TABLE IF NOT EXISTS api_aicheckerevaluation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT DEFAULT NULL,
    question_paper_id INT DEFAULT NULL,
    thread_id INT DEFAULT NULL,
    mode VARCHAR(50) DEFAULT 'normal',
    question_text TEXT DEFAULT NULL,
    student_answer TEXT DEFAULT NULL,
    question_number VARCHAR(50) DEFAULT NULL,
    question_part VARCHAR(50) DEFAULT NULL,
    question_subpart VARCHAR(50) DEFAULT NULL,
    marks_awarded INT DEFAULT 0,
    max_marks INT DEFAULT 0,
    marking_rubric JSON DEFAULT NULL,
    feedback TEXT DEFAULT NULL,
    strengths JSON DEFAULT NULL,
    improvements JSON DEFAULT NULL,
    model_used VARCHAR(100) DEFAULT NULL,
    evaluation_time_seconds FLOAT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES api_chatmessage(id) ON DELETE SET NULL,
    FOREIGN KEY (question_paper_id) REFERENCES api_document(id) ON DELETE SET NULL,
    FOREIGN KEY (thread_id) REFERENCES api_chatthread(id) ON DELETE SET NULL
);

ALTER TABLE api_flashcardset ADD COLUMN IF NOT EXISTS sources JSON DEFAULT NULL;
ALTER TABLE api_flashcard ADD COLUMN IF NOT EXISTS sources JSON DEFAULT NULL;
-- Missing table api_usersubscription
CREATE TABLE IF NOT EXISTS api_usersubscription (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    tier VARCHAR(50) DEFAULT 'free',
    revenuecat_app_user_id VARCHAR(255) DEFAULT NULL,
    store VARCHAR(50) DEFAULT NULL,
    product_id VARCHAR(255) DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 0,
    expires_at DATETIME DEFAULT NULL,
    original_purchase_date DATETIME DEFAULT NULL,
    cancellation_date DATETIME DEFAULT NULL,
    last_webhook_event DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE
);

-- Missing table api_userusagelimit
CREATE TABLE IF NOT EXISTS api_userusagelimit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    flashcard_sets_created INT DEFAULT 0,
    quizzes_created INT DEFAULT 0,
    ai_checker_uses INT DEFAULT 0,
    past_paper_questions_used INT DEFAULT 0,
    study_sessions_created INT DEFAULT 0,
    chat_messages_sent INT DEFAULT 0,
    mcq_wrong_reviews_used INT DEFAULT 0,
    current_week_end DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE
);

-- Missing table api_aiusagelog
CREATE TABLE IF NOT EXISTS api_aiusagelog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    feature VARCHAR(100) NOT NULL,
    tokens_used INT DEFAULT 0,
    model_name VARCHAR(100) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE
);

-- Missing table api_sessionquestionusage
CREATE TABLE IF NOT EXISTS api_sessionquestionusage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_question_id INT NOT NULL UNIQUE,
    answer_revisions INT DEFAULT 0,
    followup_messages INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_question_id) REFERENCES api_sessionquestion(id) ON DELETE CASCADE
);

-- Missing table api_documentextractioncache
CREATE TABLE IF NOT EXISTS api_documentextractioncache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_paper_id INT NOT NULL,
    mark_scheme_id INT DEFAULT NULL,
    extraction_data JSON DEFAULT NULL,
    extraction_model VARCHAR(100) DEFAULT NULL,
    processing_time_seconds FLOAT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_paper_id) REFERENCES api_document(id) ON DELETE CASCADE,
    FOREIGN KEY (mark_scheme_id) REFERENCES api_document(id) ON DELETE SET NULL
);

ALTER TABLE api_quiz ADD COLUMN IF NOT EXISTS sources JSON DEFAULT NULL;
ALTER TABLE api_quizquestion ADD COLUMN IF NOT EXISTS sources JSON DEFAULT NULL;
ALTER TABLE api_quizattempt ADD COLUMN IF NOT EXISTS completed_at DATETIME DEFAULT NULL;
-- Missing table api_devicetoken
CREATE TABLE IF NOT EXISTS api_devicetoken (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    platform VARCHAR(50) DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE
);

-- Missing table api_questionmapping
CREATE TABLE IF NOT EXISTS api_questionmapping (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_paper_id INT NOT NULL,
    mapping_data JSON DEFAULT NULL,
    FOREIGN KEY (question_paper_id) REFERENCES api_document(id) ON DELETE CASCADE
);

-- Missing table api_mcqanswerkey
CREATE TABLE IF NOT EXISTS api_mcqanswerkey (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    key_data JSON DEFAULT NULL,
    FOREIGN KEY (quiz_id) REFERENCES api_mcqquiz(id) ON DELETE CASCADE
);

-- Missing table api_ragchunk
CREATE TABLE IF NOT EXISTS api_ragchunk (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    content TEXT DEFAULT NULL,
    FOREIGN KEY (document_id) REFERENCES api_document(id) ON DELETE CASCADE
);

