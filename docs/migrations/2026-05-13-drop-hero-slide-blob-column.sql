-- Drop the media_data LONGBLOB column from hero_slides.
--
-- Prerequisites before running this:
-- 1) All existing rows must have media_path set (confirmed 2026-05-11 migration).
-- 2) Application code must be deployed without any blob read/write references.
-- 3) Verify no active rows rely on media_data (query below).
--
-- Safety check (run first, expect 0 rows):
--   SELECT id FROM hero_slides WHERE media_path IS NULL AND is_active = 1;
--
-- Rollback: there is no rollback for this drop. Data in media_data will be
-- permanently deleted. Only run after confirming S3 is fully operational.

ALTER TABLE hero_slides
  DROP COLUMN media_data;
