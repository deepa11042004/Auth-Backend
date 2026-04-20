-- Optional: create/select database first.
-- CREATE DATABASE IF NOT EXISTS bserc_core_db;
-- USE bserc_core_db;

CREATE TABLE IF NOT EXISTS hero_slides (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NULL,
  subtitle TEXT NULL,
  media_type ENUM('image', 'video') NULL,
  media_data LONGBLOB NULL,
  media_mime_type VARCHAR(120) NULL,
  cta_text VARCHAR(255) NULL,
  cta_link TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  position INT NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_hero_slides_active_position (is_active, position),
  INDEX idx_hero_slides_position (position)
);

-- Public metadata only (without blob):
-- SELECT id, title, subtitle, media_type, media_mime_type, cta_text, cta_link, is_active, position, created_at, updated_at
-- FROM hero_slides
-- WHERE is_active = 1
-- ORDER BY position ASC, id ASC;
