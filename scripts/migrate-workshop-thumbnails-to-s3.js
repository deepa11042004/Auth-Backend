/**
 * migrate-workshop-thumbnails-to-s3.js
 *
 * Copies existing workshop thumbnail blobs from MySQL to S3.
 * Existing blobs are intentionally kept for legacy fallback.
 *
 * Env vars:
 *   MIGRATION_BATCH_SIZE   - rows per batch (default 10)
 *   MIGRATION_DRY_RUN      - true/false, skip DB writes (default false)
 *
 * Usage:
 *   node scripts/migrate-workshop-thumbnails-to-s3.js
 *   MIGRATION_DRY_RUN=true node scripts/migrate-workshop-thumbnails-to-s3.js
 */

require('dotenv').config();

const db = require('../src/config/db');
const { uploadWorkshopThumbnail } = require('../src/services/s3StorageService');

const TABLE = 'workshop_list';
const DEFAULT_BATCH_SIZE = 10;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

async function fetchBatch(limit, lastId) {
  const [rows] = await db.query(
    `SELECT id, title, thumbnail
     FROM ${TABLE}
     WHERE thumbnail IS NOT NULL
       AND (thumbnail_path IS NULL OR thumbnail_path = '')
       AND id > ?
     ORDER BY id ASC
     LIMIT ?`,
    [lastId, limit],
  );

  return rows;
}

async function migrateRow(row, options) {
  const buffer = row.thumbnail;

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { id: row.id, skipped: true, reason: 'Empty or invalid thumbnail blob' };
  }

  const originalName = `workshop-thumbnail-${row.id}.webp`;

  const uploadResult = await uploadWorkshopThumbnail({
    buffer,
    mimeType: 'image/webp',
    originalName,
    workshopId: String(row.id),
    workshopTitle: row.title || `workshop-${row.id}`,
  });

  if (options.dryRun) {
    console.log(`  [dry-run] id=${row.id} would upload to ${uploadResult.s3Path}`);
    return { id: row.id, skipped: true, reason: 'Dry run' };
  }

  await db.query(
    `UPDATE ${TABLE}
     SET thumbnail_path               = ?,
         thumbnail_file_name          = ?,
         thumbnail_storage            = 'hybrid',
         thumbnail_migrated_from_blob = 1
     WHERE id = ?
     LIMIT 1`,
    [uploadResult.s3Path, originalName, row.id],
  );

  return { id: row.id, migrated: true, s3Path: uploadResult.s3Path };
}

async function run() {
  const batchSize = toNumber(process.env.MIGRATION_BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const dryRun = toBoolean(process.env.MIGRATION_DRY_RUN);

  console.log(`Starting workshop thumbnail S3 migration (batchSize=${batchSize}, dryRun=${dryRun})`);

  let lastId = 0;
  let total = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    while (true) {
      const rows = await fetchBatch(batchSize, lastId);

      if (rows.length === 0) {
        break;
      }

      console.log(`Processing batch: ids ${rows[0].id} - ${rows[rows.length - 1].id}`);

      for (const row of rows) {
        total += 1;

        try {
          const result = await migrateRow(row, { dryRun });

          if (result.migrated) {
            migrated += 1;
            console.log(`  yes id=${row.id} -> ${result.s3Path}`);
          } else {
            skipped += 1;
            console.log(`  skip id=${row.id}: ${result.reason}`);
          }
        } catch (err) {
          failed += 1;
          console.error(`  fail id=${row.id}: ${err.message || err}`);
        }
      }

      lastId = rows[rows.length - 1].id;
    }

    console.log(
      `\nMigration complete. total=${total} migrated=${migrated} skipped=${skipped} failed=${failed}`,
    );

    if (dryRun) {
      console.log('(Dry run - no rows were modified)');
    }
  } finally {
    await db.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  db.end().finally(() => process.exit(1));
});
