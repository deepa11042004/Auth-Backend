-- Add S3 storage metadata columns for mentor registration resume/profile photos.
-- New mentor uploads can use S3 directly while legacy blobs stay available for fallback.

ALTER TABLE mentor_registrations
  ADD COLUMN resume_path VARCHAR(1024) NULL AFTER resume,
  ADD COLUMN resume_file_name VARCHAR(255) NULL AFTER resume_path,
  ADD COLUMN resume_mime_type VARCHAR(120) NULL AFTER resume_file_name,
  ADD COLUMN resume_storage ENUM('blob', 's3', 'hybrid') NOT NULL DEFAULT 'blob' AFTER resume_mime_type,
  ADD COLUMN resume_migrated_from_blob TINYINT(1) NOT NULL DEFAULT 0 AFTER resume_storage,
  ADD COLUMN profile_photo_path VARCHAR(1024) NULL AFTER profile_photo,
  ADD COLUMN profile_photo_file_name VARCHAR(255) NULL AFTER profile_photo_path,
  ADD COLUMN profile_photo_mime_type VARCHAR(120) NULL AFTER profile_photo_file_name,
  ADD COLUMN profile_photo_storage ENUM('blob', 's3', 'hybrid') NOT NULL DEFAULT 'blob' AFTER profile_photo_mime_type,
  ADD COLUMN profile_photo_migrated_from_blob TINYINT(1) NOT NULL DEFAULT 0 AFTER profile_photo_storage,
  ADD INDEX idx_mentor_resume_path (resume_path(191)),
  ADD INDEX idx_mentor_profile_photo_path (profile_photo_path(191));




-- for rollback 
-- ALTER TABLE mentor_registrations
--   DROP INDEX idx_mentor_resume_path,
--   DROP INDEX idx_mentor_profile_photo_path,
--   DROP COLUMN resume_path,
--   DROP COLUMN resume_file_name,
--   DROP COLUMN resume_mime_type,
--   DROP COLUMN resume_storage,
--   DROP COLUMN resume_migrated_from_blob,
--   DROP COLUMN profile_photo_path,
--   DROP COLUMN profile_photo_file_name,
--   DROP COLUMN profile_photo_mime_type,
--   DROP COLUMN profile_photo_storage,
--   DROP COLUMN profile_photo_migrated_from_blob;