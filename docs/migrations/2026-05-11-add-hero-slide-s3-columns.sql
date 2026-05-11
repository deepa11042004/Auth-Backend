-- Add S3 storage metadata columns to hero_slides.
-- New uploads will be stored in S3 only (media_data stays NULL).
-- Existing blobs are kept as fallback for migrated rows (media_storage = 'hybrid').
-- Run this before deploying the S3-enabled backend build.
--
-- Rollback note:
-- Use the companion rollback migration only before production cutover, or after
-- reverting the application code and confirming no required S3-only rows depend
-- on these columns. Dropping these columns after new S3-only uploads exist will
-- remove the DB references for those objects.

ALTER TABLE hero_slides
  ADD COLUMN media_path        VARCHAR(1024)                       NULL          AFTER media_mime_type,
  ADD COLUMN media_file_name   VARCHAR(255)                        NULL          AFTER media_path,
  ADD COLUMN media_storage     ENUM('blob', 's3', 'hybrid')        NOT NULL      DEFAULT 'blob' AFTER media_file_name,
  ADD COLUMN migrated_from_blob TINYINT(1)                         NOT NULL      DEFAULT 0      AFTER media_storage,
  ADD INDEX  idx_hero_slides_media_path (media_path(191));
