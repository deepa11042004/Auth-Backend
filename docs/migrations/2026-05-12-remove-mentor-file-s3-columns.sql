-- Rollback: remove mentor S3 metadata columns added in 2026-05-12-add-mentor-file-s3-columns.sql
-- Run only after reverting app code that reads/writes these fields.
-- for rollback only
ALTER TABLE mentor_registrations
  DROP INDEX idx_mentor_resume_path,
  DROP INDEX idx_mentor_profile_photo_path,
  DROP COLUMN resume_path,
  DROP COLUMN resume_file_name,
  DROP COLUMN resume_mime_type,
  DROP COLUMN resume_storage,
  DROP COLUMN resume_migrated_from_blob,
  DROP COLUMN profile_photo_path,
  DROP COLUMN profile_photo_file_name,
  DROP COLUMN profile_photo_mime_type,
  DROP COLUMN profile_photo_storage,
  DROP COLUMN profile_photo_migrated_from_blob;
