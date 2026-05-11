-- Roll back the hero_slides S3 metadata columns.
--
-- Only run this if:
-- 1) the application has been reverted to the blob-only version, and
-- 2) no required S3-only hero slides depend on media_path/media_storage, or
--    you intentionally accept losing those DB references.
--
-- Existing legacy blob data in media_data is not touched by this rollback.

ALTER TABLE hero_slides
  DROP INDEX idx_hero_slides_media_path,
  DROP COLUMN migrated_from_blob,
  DROP COLUMN media_storage,
  DROP COLUMN media_file_name,
  DROP COLUMN media_path;