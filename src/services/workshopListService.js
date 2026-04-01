const db = require('../config/db');

const WORKSHOP_LIST_TABLE = 'workshop_list';
const REGISTRATION_TABLE = 'workshop_registrations';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
const IMAGE_COLUMNS = new Set(['thumbnail', 'certificate_file']);

function cleanText(value) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }

  return typeof value === 'string' ? value.trim() : '';
}

function toNullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function toNullableFee(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

function toBoolean(value, defaultValue = true) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = cleanText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function toPositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function isValidDate(value) {
  if (!value) {
    return true;
  }

  if (!DATE_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day
  );
}

function isValidTime(value) {
  if (!value) {
    return true;
  }

  return TIME_REGEX.test(value);
}

function isValidUrlOrPath(value) {
  if (!value) {
    return true;
  }

  const candidate = cleanText(value);
  if (!candidate) {
    return false;
  }

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_err) {
    // Not a full URL. Continue with local/relative path validation.
  }

  return /^(\/|\.\/|\.\.\/|[A-Za-z]:\\|[A-Za-z0-9_./\\-]+)$/.test(candidate);
}

function failedResponse(status) {
  return {
    status,
    body: {
      success: false,
      message: 'Failed to create workshop',
    },
  };
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  const asString = String(value).trim();
  return asString || null;
}

function formatTime(value) {
  if (!value) {
    return null;
  }

  const asString = String(value).trim();
  return asString || null;
}

function buildWorkshopImageUrl(id, type) {
  return `/api/workshop-list/${id}/${type}`;
}

function mapWorkshopRow(row) {
  const id = Number(row.id);
  const thumbnailUrl = row.thumbnail_url
    ? String(row.thumbnail_url)
    : (row.thumbnail ? buildWorkshopImageUrl(id, 'thumbnail') : null);
  const certificateUrl = row.certificate_url
    ? String(row.certificate_url)
    : (row.certificate_file ? buildWorkshopImageUrl(id, 'certificate') : null);
  const registeredCount = Number(row.registered_count);

  return {
    id,
    title: row.title,
    description: row.description,
    eligibility: row.eligibility,
    mode: row.mode,
    workshop_date: formatDate(row.workshop_date),
    start_time: formatTime(row.start_time),
    end_time: formatTime(row.end_time),
    duration: row.duration,
    certificate: Number(row.certificate || 0) === 1,
    fee: row.fee === null ? null : Number(row.fee),
    registered_count: Number.isFinite(registeredCount) ? registeredCount : 0,
    thumbnail_url: thumbnailUrl,
    certificate_url: certificateUrl,
    has_thumbnail: Boolean(row.thumbnail),
    has_certificate_file: Boolean(row.certificate_file),
  };
}

async function getWorkshopList() {
  const [rows] = await db.query(
    `SELECT
      wl.id,
      wl.title,
      wl.description,
      wl.eligibility,
      wl.mode,
      wl.workshop_date,
      wl.start_time,
      wl.end_time,
      wl.duration,
      wl.certificate,
      wl.fee,
      wl.thumbnail_url,
      wl.thumbnail,
      wl.certificate_url,
      wl.certificate_file,
      COALESCE(reg.registration_count, 0) AS registered_count
    FROM ${WORKSHOP_LIST_TABLE} wl
    LEFT JOIN (
      SELECT workshop_id, COUNT(*) AS registration_count
      FROM ${REGISTRATION_TABLE}
      GROUP BY workshop_id
    ) reg ON reg.workshop_id = wl.id
    ORDER BY wl.id DESC`
  );

  return rows.map(mapWorkshopRow);
}

async function createWorkshop(payload) {
  const title = cleanText(payload.title);
  const description = toNullableText(payload.description);
  const eligibility = toNullableText(payload.eligibility);
  const mode = toNullableText(payload.mode);
  const workshopDate = toNullableText(payload.workshop_date);
  const startTime = toNullableText(payload.start_time);
  const endTime = toNullableText(payload.end_time);
  const duration = toNullableText(payload.duration);
  const certificate = toBoolean(payload.certificate, true) ? 1 : 0;
  const fee = toNullableFee(payload.fee);
  const thumbnailUrl = toNullableText(payload.thumbnail_url);
  const certificateUrl = toNullableText(payload.certificate_url);
  const thumbnailBuffer = Buffer.isBuffer(payload.thumbnail) ? payload.thumbnail : null;
  const certificateBuffer = Buffer.isBuffer(payload.certificate_file)
    ? payload.certificate_file
    : null;

  if (!title) {
    return failedResponse(400);
  }

  if (payload.fee !== null && payload.fee !== undefined && payload.fee !== '' && fee === null) {
    return failedResponse(400);
  }

  if (!isValidDate(workshopDate)) {
    return failedResponse(400);
  }

  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return failedResponse(400);
  }

  const thumbnailUrlValid = isValidUrlOrPath(thumbnailUrl);
  const certificateUrlValid = isValidUrlOrPath(certificateUrl);
  const storedThumbnailUrl = thumbnailBuffer ? (thumbnailUrlValid ? thumbnailUrl : null) : thumbnailUrl;
  const storedCertificateUrl = certificateBuffer
    ? (certificateUrlValid ? certificateUrl : null)
    : certificateUrl;

  if (!thumbnailBuffer && !thumbnailUrlValid) {
    return failedResponse(400);
  }

  if (!certificateBuffer && !certificateUrlValid) {
    return failedResponse(400);
  }

  await db.query(
    `INSERT INTO ${WORKSHOP_LIST_TABLE} (
      title,
      description,
      eligibility,
      mode,
      workshop_date,
      start_time,
      end_time,
      duration,
      certificate,
      fee,
      thumbnail_url,
      thumbnail,
      certificate_url,
      certificate_file
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      description,
      eligibility,
      mode,
      workshopDate,
      startTime,
      endTime,
      duration,
      certificate,
      fee,
      storedThumbnailUrl,
      thumbnailBuffer,
      storedCertificateUrl,
      certificateBuffer,
    ]
  );

  return {
    status: 201,
    body: {
      success: true,
      message: 'Workshop created successfully',
    },
  };
}

async function getWorkshopImageById(workshopId, column) {
  if (!IMAGE_COLUMNS.has(column)) {
    throw new Error(`Unsupported workshop image column: ${column}`);
  }

  const id = toPositiveInt(workshopId);
  if (!id) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid workshop id',
      },
    };
  }

  const [rows] = await db.query(
    `SELECT ${column} AS image FROM ${WORKSHOP_LIST_TABLE} WHERE id = ? LIMIT 1`,
    [id]
  );

  if (!rows[0] || !rows[0].image) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Workshop image not found',
      },
    };
  }

  return {
    status: 200,
    image: rows[0].image,
  };
}

module.exports = {
  getWorkshopList,
  createWorkshop,
  getWorkshopImageById,
};
