require('dotenv').config();

const db = require('../src/config/db');
const { uploadMouSupportingDocument } = require('../src/services/s3StorageService');

const TABLE = 'mou_requests';
const DEFAULT_BATCH_SIZE = 20;
const MAX_RETRIES = 3;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
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

function waitMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchBatch({ limit, lastId, startId, endId }) {
  const [rows] = await db.query(
    `SELECT id,
            submission_type,
            created_at,
            supporting_document_name,
            supporting_document_mime,
            supporting_document_size,
            supporting_document_data,
            supporting_document_path
     FROM ${TABLE}
     WHERE supporting_document_data IS NOT NULL
       AND (supporting_document_path IS NULL OR supporting_document_path = '')
       AND id > ?
       AND id >= ?
       AND id <= ?
     ORDER BY id ASC
     LIMIT ?`,
    [lastId, startId, endId, limit],
  );

  return rows;
}

function buildFallbackName(row) {
  const fromRow = String(row.supporting_document_name || '').trim();
  if (fromRow) {
    return fromRow;
  }

  const mime = String(row.supporting_document_mime || '').toLowerCase();
  const extMap = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };

  return `mou-supporting-document-${row.id}${extMap[mime] || ''}`;
}

async function uploadWithRetry(row) {
  const buffer = row.supporting_document_data;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { skipped: true, reason: 'Missing or empty supporting_document_data' };
  }

  const mimeType = row.supporting_document_mime || 'application/octet-stream';
  const originalName = buildFallbackName(row);

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      const uploadResult = await uploadMouSupportingDocument({
        buffer,
        mimeType,
        originalName,
        mouRequestId: String(row.id),
      });

      return {
        uploaded: true,
        s3Path: uploadResult.s3Path,
        mimeType,
        originalName,
        size: Number.isFinite(Number(row.supporting_document_size))
          ? Number(row.supporting_document_size)
          : buffer.length,
      };
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        return { failed: true, reason: err.message || String(err) };
      }

      await waitMs(attempt * 250);
    }
  }

  return { failed: true, reason: 'Upload retry exhausted' };
}

async function migrateRow(row, options) {
  const uploaded = await uploadWithRetry(row);

  if (uploaded.skipped) {
    return { id: row.id, skipped: true, reason: uploaded.reason };
  }

  if (uploaded.failed) {
    return { id: row.id, failed: true, reason: uploaded.reason };
  }

  if (options.dryRun) {
    return {
      id: row.id,
      skipped: true,
      reason: `Dry run: would set ${uploaded.s3Path}`,
    };
  }

  await db.query(
    `UPDATE ${TABLE}
     SET supporting_document_path = ?,
         supporting_document_name = ?,
         supporting_document_mime = ?,
         supporting_document_size = ?,
         supporting_document_storage = 'hybrid',
         migrated_from_blob = 1
     WHERE id = ?
       AND (supporting_document_path IS NULL OR supporting_document_path = '')
     LIMIT 1`,
    [uploaded.s3Path, uploaded.originalName, uploaded.mimeType, uploaded.size, row.id],
  );

  return { id: row.id, migrated: true, s3Path: uploaded.s3Path };
}

async function run() {
  const batchSize = toNumber(process.env.MIGRATION_BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const dryRun = toBoolean(process.env.MIGRATION_DRY_RUN);
  const startId = toNumber(process.env.MIGRATION_START_ID, 1);
  const endId = toNumber(process.env.MIGRATION_END_ID, Number.MAX_SAFE_INTEGER);

  let lastId = Math.max(0, startId - 1);
  let scanned = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const failedIds = [];

  console.log(
    `Starting MOU supporting document migration (batchSize=${batchSize}, dryRun=${dryRun}, startId=${startId}, endId=${endId})`,
  );

  try {
    while (true) {
      const rows = await fetchBatch({
        limit: batchSize,
        lastId,
        startId,
        endId,
      });

      if (rows.length === 0) {
        break;
      }

      console.log(`Processing batch: ids ${rows[0].id} - ${rows[rows.length - 1].id}`);

      for (const row of rows) {
        scanned += 1;
        try {
          const result = await migrateRow(row, { dryRun });
          if (result.migrated) {
            migrated += 1;
            console.log(`  migrated id=${row.id} -> ${result.s3Path}`);
          } else if (result.failed) {
            failed += 1;
            failedIds.push(row.id);
            console.error(`  failed id=${row.id}: ${result.reason}`);
          } else {
            skipped += 1;
            console.log(`  skipped id=${row.id}: ${result.reason}`);
          }
        } catch (err) {
          failed += 1;
          failedIds.push(row.id);
          console.error(`  failed id=${row.id}: ${err.message || err}`);
        }
      }

      lastId = rows[rows.length - 1].id;
    }

    console.log('Migration summary');
    console.log(`  scanned=${scanned}`);
    console.log(`  migrated=${migrated}`);
    console.log(`  skipped=${skipped}`);
    console.log(`  failed=${failed}`);
    if (failedIds.length > 0) {
      console.log(`  failed_ids=${failedIds.join(',')}`);
    }
    if (dryRun) {
      console.log('Dry run mode enabled: no DB rows were updated.');
    }
  } finally {
    await db.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  db.end().finally(() => process.exit(1));
});
