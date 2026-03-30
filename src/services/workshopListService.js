const db = require('../config/db');

const WORKSHOP_LIST_TABLE = 'workshop_list';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

function cleanText(value) {
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

  if (!isValidUrlOrPath(thumbnailUrl) || !isValidUrlOrPath(certificateUrl)) {
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
      certificate_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      thumbnailUrl,
      certificateUrl,
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

module.exports = {
  createWorkshop,
};
