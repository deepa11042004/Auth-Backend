const path = require('path');
const crypto = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const DEFAULT_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '';

let cachedClient = null;

function getBucketName() {
  return (
    process.env.AWS_S3_BUCKET
    || process.env.S3_BUCKET
    || process.env.AWS_BUCKET_NAME
    || ''
  ).trim();
}

function getS3Client() {
  if (cachedClient) {
    return cachedClient;
  }

  const region = DEFAULT_REGION.trim();
  if (!region) {
    throw new Error('AWS region is missing. Set AWS_REGION in the environment.');
  }

  cachedClient = new S3Client({
    region,
    credentials: {
      accessKeyId: String(process.env.AWS_ACCESS_KEY_ID || ''),
      secretAccessKey: String(process.env.AWS_SECRET_ACCESS_KEY || ''),
    },
  });

  return cachedClient;
}

function parseS3Path(s3Path) {
  const value = String(s3Path || '').trim();
  if (!value) {
    return null;
  }

  if (value.startsWith('s3://')) {
    const stripped = value.slice('s3://'.length);
    const [bucket, ...rest] = stripped.split('/');
    if (!bucket || rest.length === 0) {
      return null;
    }
    return { bucket, key: rest.join('/') };
  }

  const bucket = getBucketName();
  if (!bucket) {
    return null;
  }

  return { bucket, key: value };
}

function getPresignExpirySeconds() {
  const raw = Number(process.env.AWS_S3_PRESIGN_EXPIRES_SECONDS || 300);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 300;
  }

  return Math.min(Math.round(raw), 3600);
}

function sanitizeSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function safeExtension(originalName, mimeType) {
  const rawExt = path.extname(String(originalName || '')).toLowerCase();
  if (rawExt && rawExt.length <= 8) {
    return rawExt;
  }

  const normalized = String(mimeType || '').toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return '.jpg';
  }
  if (normalized === 'image/png') {
    return '.png';
  }
  if (normalized === 'image/webp') {
    return '.webp';
  }
  if (normalized === 'image/heic') {
    return '.heic';
  }
  if (normalized === 'image/heif') {
    return '.heif';
  }

  return '';
}

function buildInternshipPassportPhotoKey({ email, internshipName, originalName, mimeType }) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const random = crypto.randomBytes(6).toString('hex');
  const emailSlug = sanitizeSegment(email || 'unknown');
  const internshipSlug = sanitizeSegment(internshipName || 'internship');
  const extension = safeExtension(originalName, mimeType);

  return [
    'internships',
    internshipSlug || 'summer-internship',
    year,
    emailSlug || 'unknown',
    'passport-photo',
    `${timestamp}-${random}${extension}`,
  ].join('/');
}

async function uploadInternshipPassportPhoto({
  buffer,
  mimeType,
  originalName,
  email,
  internshipName,
}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Missing passport photo buffer for upload.');
  }

  const bucket = getBucketName();
  if (!bucket) {
    throw new Error('S3 bucket name is missing. Set AWS_S3_BUCKET in the environment.');
  }

  const key = buildInternshipPassportPhotoKey({
    email,
    internshipName,
    originalName,
    mimeType,
  });

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType || 'application/octet-stream',
  });

  await client.send(command);

  return {
    bucket,
    key,
    s3Path: `s3://${bucket}/${key}`,
  };
}

async function getPresignedObjectUrl({ s3Path, expiresInSeconds }) {
  const parsed = parseS3Path(s3Path);
  if (!parsed) {
    throw new Error('Invalid S3 path for presigned URL.');
  }

  const client = getS3Client();
  const expiresIn = Number.isFinite(expiresInSeconds)
    ? Math.min(Math.max(1, Math.round(expiresInSeconds)), 3600)
    : getPresignExpirySeconds();

  const command = new GetObjectCommand({
    Bucket: parsed.bucket,
    Key: parsed.key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

// ---------------------------------------------------------------------------
// Hero slide media helpers
// ---------------------------------------------------------------------------

function buildHeroSlideMediaKey({ slideId, originalName, mimeType }) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const random = crypto.randomBytes(6).toString('hex');
  const idSlug = String(slideId || 'unknown');
  const extension = safeExtension(originalName, mimeType);

  return `hero/${year}/${idSlug}-${timestamp}-${random}${extension}`;
}

async function uploadHeroSlideMedia({ buffer, mimeType, originalName, slideId }) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Missing media buffer for hero slide upload.');
  }

  const bucket = getBucketName();
  if (!bucket) {
    throw new Error('S3 bucket name is missing. Set AWS_S3_BUCKET in the environment.');
  }

  const key = buildHeroSlideMediaKey({ slideId, originalName, mimeType });
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType || 'application/octet-stream',
    }),
  );

  return { bucket, key, s3Path: `s3://${bucket}/${key}` };
}

async function streamHeroSlideMedia({ s3Path }) {
  const parsed = parseS3Path(s3Path);
  if (!parsed) {
    throw new Error('Invalid S3 path for hero slide media.');
  }

  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
  );

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return {
    buffer: Buffer.concat(chunks),
    contentType: response.ContentType || 'application/octet-stream',
    contentLength: response.ContentLength || null,
  };
}

async function deleteHeroSlideMedia({ s3Path }) {
  const parsed = parseS3Path(s3Path);
  if (!parsed) {
    return false;
  }

  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
  );

  return true;
}

module.exports = {
  uploadInternshipPassportPhoto,
  getPresignedObjectUrl,
  uploadHeroSlideMedia,
  streamHeroSlideMedia,
  deleteHeroSlideMedia,
};