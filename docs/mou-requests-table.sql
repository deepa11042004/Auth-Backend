-- Optional: create/select database first.
-- CREATE DATABASE IF NOT EXISTS bserc_core_db;
-- USE bserc_core_db;

CREATE TABLE IF NOT EXISTS mou_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  institution_name VARCHAR(255) NOT NULL,
  registered_address TEXT NOT NULL,
  signatory_name VARCHAR(255) NOT NULL,
  designation VARCHAR(150) NOT NULL,
  official_email VARCHAR(255) NOT NULL,
  official_phone VARCHAR(40) NOT NULL,
  alternative_email VARCHAR(255) NULL,
  proposal_purpose TEXT NOT NULL,
  submission_type VARCHAR(80) NOT NULL DEFAULT 'mou_proposal',
  supporting_document_name VARCHAR(255) NULL,
  supporting_document_data LONGBLOB NULL,
  supporting_document_mime VARCHAR(120) NULL,
  supporting_document_size INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mou_requests_created_at (created_at),
  INDEX idx_mou_requests_official_email (official_email),
  INDEX idx_mou_requests_submission_type (submission_type)
);

-- If table already exists from older schema, run this once:
-- ALTER TABLE mou_requests
-- ADD COLUMN supporting_document_data LONGBLOB NULL AFTER supporting_document_name;

-- Helpful admin query
-- SELECT * FROM mou_requests ORDER BY created_at DESC;
