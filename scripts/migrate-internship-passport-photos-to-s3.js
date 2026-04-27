require('dotenv').config();

const db = require('../src/config/db');
const { uploadInternshipPassportPhoto } = require('../src/services/s3StorageService');

const TABLE = 'summer_internship_registrations';
const DEFAULT_BATCH_SIZE = 25;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

async function fetchBatch(limit, lastId) {
  const [rows] = await db.query(
    `SELECT id, email, internship_name, passport_photo, passport_photo_mime_type, passport_photo_file_name
     FROM ${TABLE}
     WHERE passport_photo IS NOT NULL
       AND (passport_photo_path IS NULL OR passport_photo_path = '')
       AND id > ?
     ORDER BY id ASC
     LIMIT ?`,
    [lastId, limit]
  );

  return rows;
}

async function migrateRow(row, options) {
  const buffer = row.passport_photo;
  if (!Buffer.isBuffer(buffer)) {
    return { id: row.id, skipped: true, reason: 'Missing photo blob' };
  }

  const uploadResult = await uploadInternshipPassportPhoto({
    buffer,
    mimeType: row.passport_photo_mime_type || 'application/octet-stream',
    originalName: row.passport_photo_file_name || 'passport-photo',
    email: row.email,
    internshipName: row.internship_name,
  });

  if (options.dryRun) {
    return { id: row.id, skipped: true, reason: 'Dry run' };
  }

  const updates = [uploadResult.s3Path];
  let sql = `UPDATE ${TABLE} SET passport_photo_path = ?`;

  if (row.passport_photo_mime_type) {
    sql += ', passport_photo_mime_type = ?';
    updates.push(row.passport_photo_mime_type);
  }

  if (row.passport_photo_file_name) {
    sql += ', passport_photo_file_name = ?';
    updates.push(row.passport_photo_file_name);
  }

  if (options.clearBlobs) {
    sql += ', passport_photo = NULL';
  }

  sql += ' WHERE id = ? LIMIT 1';
  updates.push(row.id);

  await db.query(sql, updates);

  return { id: row.id, migrated: true, s3Path: uploadResult.s3Path };
}

async function run() {
  const batchSize = toNumber(process.env.MIGRATION_BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const clearBlobs = toBoolean(process.env.MIGRATION_CLEAR_BLOBS);
  const dryRun = toBoolean(process.env.MIGRATION_DRY_RUN);

  let lastId = 0;
  let total = 0;
  let migrated = 0;
  let skipped = 0;

  try {
    while (true) {
      const rows = await fetchBatch(batchSize, lastId);
      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        total += 1;
        try {
          const result = await migrateRow(row, { clearBlobs, dryRun });
          if (result.migrated) {
            migrated += 1;
          } else {
            skipped += 1;
          }
        } catch (err) {
          skipped += 1;
          console.error(`Failed to migrate internship photo id=${row.id}:`, err.message || err);
        }
      }

      lastId = rows[rows.length - 1].id;
    }

    console.log(`Migration complete. total=${total} migrated=${migrated} skipped=${skipped}`);
  } finally {
    await db.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  db.end().finally(() => process.exit(1));
});
