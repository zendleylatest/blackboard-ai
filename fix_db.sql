-- Fix missing columns in api_user
ALTER TABLE api_user ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE api_user ADD COLUMN IF NOT EXISTS apple_user_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE api_user ADD COLUMN IF NOT EXISTS google_picture_url TEXT DEFAULT NULL;

-- Create missing api_pendinguser table
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
