-- ============================================
-- Blackboard AI Local MySQL Schema Migration
-- ============================================

-- 1. Missing tables
CREATE TABLE IF NOT EXISTS api_user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    password VARCHAR(128) NOT NULL,
    is_superuser TINYINT(1) NOT NULL DEFAULT 0,
    username VARCHAR(150) NOT NULL UNIQUE,
    first_name VARCHAR(150) DEFAULT '',
    last_name VARCHAR(150) DEFAULT '',
    is_staff TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    date_joined DATETIME DEFAULT CURRENT_TIMESTAMP,
    email VARCHAR(254) NOT NULL UNIQUE,
    is_verified TINYINT(1) NOT NULL DEFAULT 0,
    login_attempts INT NOT NULL DEFAULT 0,
    role VARCHAR(50) DEFAULT 'student',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    auth_provider VARCHAR(50) DEFAULT 'email',
    profile_completed TINYINT(1) NOT NULL DEFAULT 0,
    google_id VARCHAR(255) DEFAULT NULL,
    apple_user_id VARCHAR(255) DEFAULT NULL,
    google_picture_url TEXT DEFAULT NULL,
    otp_code VARCHAR(10) DEFAULT NULL,
    otp_expiry DATETIME DEFAULT NULL,
    last_login DATETIME DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS api_pendinguser (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(150) NOT NULL,
    password VARCHAR(128) NOT NULL,
    full_name VARCHAR(255) DEFAULT NULL,
    age INT DEFAULT NULL,
    class_level VARCHAR(50) DEFAULT NULL,
    exam_board VARCHAR(50) DEFAULT NULL,
    subject_ids JSON DEFAULT NULL,
    otp_code VARCHAR(10) DEFAULT NULL,
    otp_expiry DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_userprofile (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    full_name VARCHAR(255) DEFAULT NULL,
    age INT DEFAULT NULL,
    class_level VARCHAR(50) DEFAULT NULL,
    exam_board VARCHAR(50) DEFAULT NULL,
    profile_pic_url TEXT DEFAULT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_subject (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    level VARCHAR(50) NOT NULL,
    exam_board VARCHAR(50) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    description TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS api_usersubject (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (user_id, subject_id),
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES api_subject(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_document (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    subject_id INT NOT NULL,
    gcs_key VARCHAR(500) NOT NULL,
    year INT DEFAULT NULL,
    series VARCHAR(50) DEFAULT NULL,
    paper VARCHAR(50) DEFAULT NULL,
    variant VARCHAR(50) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES api_subject(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS api_questionanswer (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_question_id INT NOT NULL,
    answer_text TEXT DEFAULT NULL,
    is_latest TINYINT(1) DEFAULT 1,
    revision_number INT DEFAULT 1,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_question_id) REFERENCES api_sessionquestion(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS api_flashcardset (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    topic VARCHAR(255) DEFAULT NULL,
    difficulty_level VARCHAR(50) DEFAULT NULL,
    is_ai_generated TINYINT(1) DEFAULT 0,
    card_count INT DEFAULT 0,
    reviews_today INT DEFAULT 0,
    reviews_total INT DEFAULT 0,
    completed_today INT DEFAULT 0,
    completed_total INT DEFAULT 0,
    mastery FLOAT DEFAULT 0,
    streak_count INT DEFAULT 0,
    sources JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_studied DATETIME DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES api_subject(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_flashcard (
    id INT AUTO_INCREMENT PRIMARY KEY,
    set_id INT NOT NULL,
    subject_id INT NOT NULL,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    difficulty_level VARCHAR(50) DEFAULT NULL,
    difficulty FLOAT DEFAULT 2.5,
    leitner_box INT DEFAULT 1,
    times_reviewed INT DEFAULT 0,
    sources JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (set_id) REFERENCES api_flashcardset(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES api_subject(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_flashcardstudysession (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    set_id INT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME DEFAULT NULL,
    total_cards INT DEFAULT 0,
    easy_count INT DEFAULT 0,
    hard_count INT DEFAULT 0,
    duration_sec INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE,
    FOREIGN KEY (set_id) REFERENCES api_flashcardset(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_flashcardreviewevent (
    id INT AUTO_INCREMENT PRIMARY KEY,
    card_id INT NOT NULL,
    session_id INT DEFAULT NULL,
    result VARCHAR(50) NOT NULL,
    reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES api_flashcard(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES api_flashcardstudysession(id) ON DELETE SET NULL
);

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

CREATE TABLE IF NOT EXISTS api_aiusagelog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    feature VARCHAR(100) NOT NULL,
    tokens_used INT DEFAULT 0,
    model_name VARCHAR(100) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_sessionquestionusage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_question_id INT NOT NULL UNIQUE,
    answer_revisions INT DEFAULT 0,
    followup_messages INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_question_id) REFERENCES api_sessionquestion(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS api_quiz (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    prompt TEXT DEFAULT NULL,
    question_count INT DEFAULT 0,
    duration_sec INT DEFAULT 0,
    times_attempted INT DEFAULT 0,
    last_score FLOAT DEFAULT 0,
    last_attempted_at DATETIME DEFAULT NULL,
    difficulty VARCHAR(50) DEFAULT NULL,
    sources JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES api_subject(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_quizquestion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    stem TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_index INT NOT NULL,
    explanation TEXT DEFAULT NULL,
    sources JSON DEFAULT NULL,
    FOREIGN KEY (quiz_id) REFERENCES api_quiz(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_quizattempt (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    user_id INT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME DEFAULT NULL,
    score FLOAT DEFAULT 0,
    FOREIGN KEY (quiz_id) REFERENCES api_quiz(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES api_user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_quizanswer (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    question_id INT NOT NULL,
    choice_index INT NOT NULL,
    is_correct TINYINT(1) DEFAULT 0,
    FOREIGN KEY (attempt_id) REFERENCES api_quizattempt(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES api_quizquestion(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS api_questionmapping (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_paper_id INT NOT NULL,
    mapping_data JSON DEFAULT NULL,
    FOREIGN KEY (question_paper_id) REFERENCES api_document(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_mcqquiz (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_id INT NOT NULL,
    title VARCHAR(255) DEFAULT NULL,
    FOREIGN KEY (subject_id) REFERENCES api_subject(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_mcqanswerkey (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id INT NOT NULL,
    key_data JSON DEFAULT NULL,
    FOREIGN KEY (quiz_id) REFERENCES api_mcqquiz(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_ragchunk (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    content TEXT DEFAULT NULL,
    FOREIGN KEY (document_id) REFERENCES api_document(id) ON DELETE CASCADE
);

-- 2. Missing columns
ALTER TABLE api_user ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE api_user ADD COLUMN IF NOT EXISTS apple_user_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE api_user ADD COLUMN IF NOT EXISTS google_picture_url TEXT DEFAULT NULL;
ALTER TABLE api_user ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';
ALTER TABLE api_user ADD COLUMN IF NOT EXISTS profile_completed TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE api_user ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10) DEFAULT NULL;
ALTER TABLE api_user ADD COLUMN IF NOT EXISTS otp_expiry DATETIME DEFAULT NULL;
ALTER TABLE api_user ADD COLUMN IF NOT EXISTS last_login DATETIME DEFAULT NULL;

ALTER TABLE api_userprofile ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT NULL;

ALTER TABLE api_document ADD COLUMN IF NOT EXISTS gcs_key VARCHAR(500) DEFAULT NULL;

-- 6. Final verification queries
-- Run \`SHOW TABLES;\` and verify that 34 tables exist.
