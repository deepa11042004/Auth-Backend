-- Add S3 metadata columns for mou_requests supporting documents.
-- New uploads can be stored in S3, while existing blob data remains for fallback.
--
-- Rollback:
-- Use this only if you need to revert the schema change before depending on the
-- new S3-backed columns in application code.
--
-- ALTER TABLE mou_requests
--   DROP INDEX idx_mou_requests_supporting_document_path,
--   DROP COLUMN migrated_from_blob,
--   DROP COLUMN supporting_document_storage,
--   DROP COLUMN supporting_document_path;

SET @schema_name := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'mou_requests'
        AND COLUMN_NAME = 'supporting_document_path'
    ),
    'SELECT ''supporting_document_path already exists'' AS info',
    'ALTER TABLE mou_requests ADD COLUMN supporting_document_path VARCHAR(1024) NULL AFTER supporting_document_size'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'mou_requests'
        AND COLUMN_NAME = 'supporting_document_storage'
    ),
    'SELECT ''supporting_document_storage already exists'' AS info',
    'ALTER TABLE mou_requests ADD COLUMN supporting_document_storage ENUM(''blob'', ''s3'', ''hybrid'') NOT NULL DEFAULT ''blob'' AFTER supporting_document_path'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'mou_requests'
        AND COLUMN_NAME = 'migrated_from_blob'
    ),
    'SELECT ''migrated_from_blob already exists'' AS info',
    'ALTER TABLE mou_requests ADD COLUMN migrated_from_blob TINYINT(1) NOT NULL DEFAULT 0 AFTER supporting_document_storage'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'mou_requests'
        AND INDEX_NAME = 'idx_mou_requests_supporting_document_path'
    ),
    'SELECT ''idx_mou_requests_supporting_document_path already exists'' AS info',
    'ALTER TABLE mou_requests ADD INDEX idx_mou_requests_supporting_document_path (supporting_document_path(191))'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
