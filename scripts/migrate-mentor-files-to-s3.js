/**
 * migrate-mentor-files-to-s3.js
 *
 * Backfills mentor resume/profile_photo blobs to S3 and marks rows as hybrid.
 * Existing blobs are intentionally kept as fallback for legacy access.
 *
 * Env vars:
 *   MIGRATION_BATCH_SIZE - rows per batch (default 20)
 *   MIGRATION_DRY_RUN    - true/false (default false)
 *
 * Usage:
 *   node scripts/migrate-mentor-files-to-s3.js
 *   MIGRATION_DRY_RUN=true node scripts/migrate-mentor-files-to-s3.js
 */

require('dotenv').config();

const db = require('../src/config/db');
const {
  uploadMentorResume,
  uploadMentorProfilePhoto,
} = require('../src/services/s3StorageService');

const TABLE = 'mentor_registrations';
const DEFAULT_BATCH_SIZE = 20;

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

function startsWithBytes(buffer, bytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) {
    return false;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    if (buffer[index] !== bytes[index]) {
      return false;
    }
  }

  return true;
}

function detectResumeMimeType(buffer) {
  if (startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46])) {
    return 'application/pdf';
  }

  if (startsWithBytes(buffer, [0xD0, 0xCF, 0x11, 0xE0])) {
    return 'application/msword';
  }

  if (startsWithBytes(buffer, [0x50, 0x4B, 0x03, 0x04])) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  return 'application/octet-stream';
}

function detectProfilePhotoMimeType(buffer) {
  if (startsWithBytes(buffer, [0xFF, 0xD8, 0xFF])) {
    return 'image/jpeg';
  }

  if (startsWithBytes(buffer, [0x89, 0x50, 0x4E, 0x47])) {
    return 'image/png';
  }

  if (
    startsWithBytes(buffer, [0x52, 0x49, 0x46, 0x46])
    && buffer.length > 11
    && buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (startsWithBytes(buffer, [0x47, 0x49, 0x46, 0x38])) {
    return 'image/gif';
  }

  return 'application/octet-stream';
}

function extensionForMimeType(mimeType) {
  const map = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  return map[mimeType] || 'bin';
}

async function fetchBatch(limit, lastId) {
  const [rows] = await db.query(
    `SELECT id, email, resume, profile_photo, resume_path, profile_photo_path
     FROM ${TABLE}
     WHERE id > ?
       AND (
         (resume IS NOT NULL AND (resume_path IS NULL OR resume_path = ''))
         OR
         (profile_photo IS NOT NULL AND (profile_photo_path IS NULL OR profile_photo_path = ''))
       )
     ORDER BY id ASC
     LIMIT ?`,
    [lastId, limit],
  );

  return rows;
}

async function migrateRow(row, options) {
  const updates = [];
  const params = [];

  if (Buffer.isBuffer(row.resume) && (!row.resume_path || String(row.resume_path).trim() === '')) {
    const resumeMimeType = detectResumeMimeType(row.resume);
    const resumeFileName = `mentor-${row.id}-resume.${extensionForMimeType(resumeMimeType)}`;

    const resumeUpload = await uploadMentorResume({
      buffer: row.resume,
      mimeType: resumeMimeType,
      originalName: resumeFileName,
      email: row.email,
    });

    updates.push('resume_path = ?');
    params.push(resumeUpload.s3Path);
    updates.push('resume_file_name = ?');
    params.push(resumeFileName);
    updates.push('resume_mime_type = ?');
    params.push(resumeMimeType);
    updates.push("resume_storage = 'hybrid'");
    updates.push('resume_migrated_from_blob = 1');
  }

  if (
    Buffer.isBuffer(row.profile_photo)
    && (!row.profile_photo_path || String(row.profile_photo_path).trim() === '')
  ) {
    const profilePhotoMimeType = detectProfilePhotoMimeType(row.profile_photo);
    const profilePhotoFileName = `mentor-${row.id}-profile-photo.${extensionForMimeType(profilePhotoMimeType)}`;

    const profilePhotoUpload = await uploadMentorProfilePhoto({
      buffer: row.profile_photo,
      mimeType: profilePhotoMimeType,
      originalName: profilePhotoFileName,
      email: row.email,
    });

    updates.push('profile_photo_path = ?');
    params.push(profilePhotoUpload.s3Path);
    updates.push('profile_photo_file_name = ?');
    params.push(profilePhotoFileName);
    updates.push('profile_photo_mime_type = ?');
    params.push(profilePhotoMimeType);
    updates.push("profile_photo_storage = 'hybrid'");
    updates.push('profile_photo_migrated_from_blob = 1');
  }

  if (updates.length === 0) {
    return { id: row.id, skipped: true, reason: 'No eligible files for migration' };
  }

  if (options.dryRun) {
    return { id: row.id, skipped: true, reason: 'Dry run' };
  }

  params.push(row.id);

  await db.query(
    `UPDATE ${TABLE}
     SET ${updates.join(', ')}
     WHERE id = ?
     LIMIT 1`,
    params,
  );

  return { id: row.id, migrated: true };
}

async function run() {
  const batchSize = toNumber(process.env.MIGRATION_BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const dryRun = toBoolean(process.env.MIGRATION_DRY_RUN);

  console.log(`Starting mentor file S3 migration (batchSize=${batchSize}, dryRun=${dryRun})`);

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
            console.log(`  yes id=${row.id} migrated`);
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

    console.log(`\nMigration complete. total=${total} migrated=${migrated} skipped=${skipped} failed=${failed}`);

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
