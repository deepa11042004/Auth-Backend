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
  supporting_document_mime VARCHAR(120) NULL,
  supporting_document_size INT NULL,
  supporting_document_path VARCHAR(1024) NULL,
  supporting_document_storage ENUM('s3', 'hybrid') NOT NULL DEFAULT 's3',
  migrated_from_blob TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mou_requests_created_at (created_at),
  INDEX idx_mou_requests_official_email (official_email),
  INDEX idx_mou_requests_submission_type (submission_type),
  INDEX idx_mou_requests_supporting_document_path (supporting_document_path(191))
);

-- If table already exists from older schema, run this once:
-- ALTER TABLE mou_requests
-- ADD COLUMN supporting_document_path VARCHAR(1024) NULL AFTER supporting_document_size,
-- ADD COLUMN supporting_document_storage ENUM('s3', 'hybrid') NOT NULL DEFAULT 's3' AFTER supporting_document_path,
-- ADD COLUMN migrated_from_blob TINYINT(1) NOT NULL DEFAULT 0 AFTER supporting_document_storage,
-- ADD INDEX idx_mou_requests_supporting_document_path (supporting_document_path(191));

-- Helpful admin query
-- SELECT * FROM mou_requests ORDER BY created_at DESC;
