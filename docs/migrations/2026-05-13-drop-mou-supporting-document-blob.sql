-- Drop legacy BLOB payload from mou_requests after confirming S3 migration.
--
-- Preconditions (run verification first):
-- 1) Every row with a document has supporting_document_path populated.
-- 2) Application build already removed BLOB fallback logic.
--
-- WARNING: This migration is destructive. Binary document bytes in
-- supporting_document_data cannot be recovered from this database after drop.

ALTER TABLE mou_requests
  DROP COLUMN supporting_document_data;

-- Optional normalization after BLOB removal:
-- UPDATE mou_requests
-- SET supporting_document_storage = 's3'
-- WHERE supporting_document_storage = 'hybrid';
