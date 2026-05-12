-- Add S3 metadata columns for workshop_list thumbnail storage.
-- Existing thumbnail blobs remain in place for legacy fallback.
--
-- Rollback:
-- Use this only before production cutover or after reverting code that depends on
-- these columns.
--
-- ALTER TABLE workshop_list
--   DROP INDEX idx_workshop_list_thumbnail_path,
--   DROP COLUMN thumbnail_migrated_from_blob,
--   DROP COLUMN thumbnail_storage,
--   DROP COLUMN thumbnail_file_name,
--   DROP COLUMN thumbnail_path;

SET @schema_name := DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @schema_name
        AND TABLE_NAME = 'workshop_list'
        AND COLUMN_NAME = 'thumbnail_path'
    ),
    'SELECT ''thumbnail_path already exists'' AS info',
    'ALTER TABLE workshop_list ADD COLUMN thumbnail_path VARCHAR(1024) NULL AFTER thumbnail_url'
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
        AND TABLE_NAME = 'workshop_list'
        AND COLUMN_NAME = 'thumbnail_file_name'
    ),
    'SELECT ''thumbnail_file_name already exists'' AS info',
    'ALTER TABLE workshop_list ADD COLUMN thumbnail_file_name VARCHAR(255) NULL AFTER thumbnail_path'
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
        AND TABLE_NAME = 'workshop_list'
        AND COLUMN_NAME = 'thumbnail_storage'
    ),
    'SELECT ''thumbnail_storage already exists'' AS info',
    'ALTER TABLE workshop_list ADD COLUMN thumbnail_storage ENUM(''blob'', ''s3'', ''hybrid'') NOT NULL DEFAULT ''blob'' AFTER thumbnail_file_name'
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
        AND TABLE_NAME = 'workshop_list'
        AND COLUMN_NAME = 'thumbnail_migrated_from_blob'
    ),
    'SELECT ''thumbnail_migrated_from_blob already exists'' AS info',
    'ALTER TABLE workshop_list ADD COLUMN thumbnail_migrated_from_blob TINYINT(1) NOT NULL DEFAULT 0 AFTER thumbnail_storage'
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
        AND TABLE_NAME = 'workshop_list'
        AND INDEX_NAME = 'idx_workshop_list_thumbnail_path'
    ),
    'SELECT ''idx_workshop_list_thumbnail_path already exists'' AS info',
    'ALTER TABLE workshop_list ADD INDEX idx_workshop_list_thumbnail_path (thumbnail_path(191))'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
