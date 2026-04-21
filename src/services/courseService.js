const db = require('../config/db');

const lmsDB = db.lmsDB;
const bsercDB = db.bsercDB || db;

const ALLOWED_LEVELS = new Set(['Beginner', 'Intermediate', 'Advanced']);

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSlugBase(rawSlug, title) {
  const source = cleanText(rawSlug) || cleanText(title) || `course-${Date.now()}`;
  const normalized = slugify(source) || `course-${Date.now()}`;
  return normalized.slice(0, 120).replace(/-+$/g, '') || 'course';
}

function generateSlugSuffix() {
  const randomPart = Math.random().toString(36).slice(2, 6);
  const timePart = Date.now().toString(36).slice(-4);
  return `${randomPart}${timePart}`;
}

async function ensureUniqueSlug(rawSlug, title) {
  const base = buildSlugBase(rawSlug, title);
  let candidate = base;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const [rows] = await lmsDB.query('SELECT id FROM courses WHERE slug = ? LIMIT 1', [candidate]);
    if (!rows[0]) {
      return candidate;
    }

    const suffix = generateSlugSuffix();
    const maxBaseLength = Math.max(1, 120 - suffix.length - 1);
    const trimmedBase = base.slice(0, maxBaseLength).replace(/-+$/g, '') || 'course';
    candidate = `${trimmedBase}-${suffix}`;
  }

  throw new Error('Could not generate a unique slug');
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function toNullableInt(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function toBoolean(value, defaultValue = false) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function mapCourseCard(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    subtitle: row.subtitle,
    description: row.description,
    category: row.category,
    level: row.level,
    language: row.language,
    thumbnail: row.thumbnail,
    price: row.price === null ? 0 : Number(row.price),
    discount_price: row.discount_price === null ? null : Number(row.discount_price),
    currency: row.currency,
    is_paid: Boolean(row.is_paid),
    lifetime_access: Boolean(row.lifetime_access),
    certificate_available: Boolean(row.certificate_available),
    instructor_id: row.instructor_id,
    total_duration_minutes: Number(row.total_duration_minutes || 0),
    enrolled_students: Number(row.enrolled_students || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    // Compatibility fields consumed by existing frontend code.
    discountPrice: row.discount_price === null ? null : Number(row.discount_price),
    isPaid: Boolean(row.is_paid),
    lifetimeAccess: Boolean(row.lifetime_access),
    certificateAvailable: Boolean(row.certificate_available),
    instructorId: row.instructor_id,
    totalDurationMinutes: Number(row.total_duration_minutes || 0),
    enrolledStudents: Number(row.enrolled_students || 0),
    rating: 0,
  };
}

async function getPublishedCourses({ page = 1, limit = 20 } = {}) {
  const safePage = toPositiveInt(page, 1);
  const safeLimit = Math.min(toPositiveInt(limit, 20), 100);
  const offset = (safePage - 1) * safeLimit;

  const [countRows] = await lmsDB.query('SELECT COUNT(*) AS total FROM courses');

  const [rows] = await lmsDB.query(
    `SELECT
      c.id,
      c.title,
      c.slug,
      c.subtitle,
      c.description,
      c.category,
      c.level,
      c.language,
      c.thumbnail,
      c.price,
      c.discount_price,
      c.currency,
      c.is_paid,
      c.lifetime_access,
      c.certificate_available,
      c.instructor_id,
      c.total_duration_minutes,
      c.enrolled_students,
      c.created_at,
      c.updated_at
    FROM courses c
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT ? OFFSET ?`,
    [safeLimit, offset]
  );

  const total = Number(countRows[0]?.total || 0);

  return {
    courses: rows.map(mapCourseCard),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / safeLimit),
    },
  };
}

async function getPublishedCourseDetailBySlug(slug) {
  const safeSlug = cleanText(slug);
  if (!safeSlug) {
    return null;
  }

  const [courseRows] = await lmsDB.query(
    `SELECT
      c.id,
      c.slug,
      c.title,
      c.subtitle,
      c.description,
      c.category,
      c.level,
      c.language,
      c.thumbnail,
      c.price,
      c.discount_price,
      c.currency,
      c.is_paid,
      c.lifetime_access,
      c.certificate_available,
      c.instructor_id,
      c.total_duration_minutes,
      c.enrolled_students,
      c.created_at,
      c.updated_at
    FROM courses c
    WHERE c.slug = ?
    LIMIT 1`,
    [safeSlug]
  );

  const course = courseRows[0];
  if (!course) {
    return null;
  }

  let instructor = null;
  if (course.instructor_id) {
    try {
      const [instructorRows] = await bsercDB.query(
        'SELECT id, full_name FROM users WHERE id = ? LIMIT 1',
        [course.instructor_id]
      );
      instructor = instructorRows[0] || null;
    } catch (err) {
      // Allow course detail response even if user table is unavailable.
      instructor = null;
    }
  }

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    category: course.category,
    level: course.level,
    language: course.language,
    thumbnail: course.thumbnail,
    price: course.price === null ? 0 : Number(course.price),
    discount_price: course.discount_price === null ? null : Number(course.discount_price),
    currency: course.currency,
    is_paid: Boolean(course.is_paid),
    lifetime_access: Boolean(course.lifetime_access),
    certificate_available: Boolean(course.certificate_available),
    instructor_id: course.instructor_id,
    total_duration_minutes: Number(course.total_duration_minutes || 0),
    enrolled_students: Number(course.enrolled_students || 0),
    created_at: course.created_at,
    updated_at: course.updated_at,
    // Compatibility fields consumed by existing frontend code.
    discountPrice: course.discount_price === null ? null : Number(course.discount_price),
    isPaid: Boolean(course.is_paid),
    lifetimeAccess: Boolean(course.lifetime_access),
    certificateAvailable: Boolean(course.certificate_available),
    instructorId: course.instructor_id,
    totalDurationMinutes: Number(course.total_duration_minutes || 0),
    enrolledStudents: Number(course.enrolled_students || 0),
    rating: 0,
    instructor: {
      id: instructor?.id || course.instructor_id,
      name: instructor?.full_name || null,
      avatar: null,
    },
    curriculum: [],
  };
}

async function createCourse(payload, authUser) {
  const title = cleanText(payload.title);
  if (!title) {
    return { status: 400, body: { message: 'title is required' } };
  }

  const subtitle = nullableText(payload.subtitle);
  const description = nullableText(payload.description);
  const category = nullableText(payload.category);
  if (!category) {
    return { status: 400, body: { message: 'category is required' } };
  }

  const level = nullableText(payload.level);
  if (!level) {
    return { status: 400, body: { message: 'level is required' } };
  }

  if (level && !ALLOWED_LEVELS.has(level)) {
    return { status: 400, body: { message: 'Invalid level value' } };
  }

  const language = nullableText(payload.language);
  const thumbnail = nullableText(payload.thumbnail);

  const rawPrice = toNullableNumber(payload.price);
  if (rawPrice !== null && rawPrice < 0) {
    return { status: 400, body: { message: 'price must be greater than or equal to 0' } };
  }

  const isPaid = toBoolean(payload.isPaid ?? payload.is_paid, rawPrice !== null && rawPrice > 0) ? 1 : 0;

  if (isPaid === 1 && rawPrice === null) {
    return { status: 400, body: { message: 'price is required for paid courses' } };
  }

  const price = isPaid === 1 ? (rawPrice === null ? 0 : rawPrice) : 0;
  const discountPrice = toNullableNumber(payload.discountPrice ?? payload.discount_price);
  if (discountPrice !== null && discountPrice < 0) {
    return { status: 400, body: { message: 'discount_price must be greater than or equal to 0' } };
  }

  if (discountPrice !== null && discountPrice > price) {
    return { status: 400, body: { message: 'discount_price cannot be greater than price' } };
  }

  const currency = nullableText(payload.currency) || 'INR';

  const lifetimeAccess = toBoolean(payload.lifetimeAccess ?? payload.lifetime_access, true) ? 1 : 0;
  const certificateAvailable = toBoolean(payload.certificateAvailable ?? payload.certificate_available, true) ? 1 : 0;
  const totalDurationMinutes = Math.max(0, toNullableInt(payload.totalDurationMinutes ?? payload.total_duration_minutes) || 0);
  const enrolledStudents = 0;

  let instructorId = toNullableInt(payload.instructorId ?? payload.instructor_id);
  if (!instructorId) {
    instructorId = toNullableInt(authUser?.userId);
  }

  if (!instructorId && authUser?.role === 'instructor') {
    instructorId = toNullableInt(authUser?.userId);
  }

  if (!instructorId) {
    return { status: 400, body: { message: 'Valid instructor_id is required' } };
  }

  try {
    const [instructorRows] = await bsercDB.query('SELECT id FROM users WHERE id = ? LIMIT 1', [instructorId]);
    if (!instructorRows[0]) {
      return { status: 404, body: { message: 'Instructor not found' } };
    }
  } catch (err) {
    // If users table is unavailable in current environment, skip strict check.
    if (err.code !== 'ER_NO_SUCH_TABLE' && err.code !== 'ER_BAD_DB_ERROR') {
      throw err;
    }
  }

  let slug = await ensureUniqueSlug(payload.slug, title);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const [result] = await lmsDB.query(
        `INSERT INTO courses (
          title,
          slug,
          subtitle,
          description,
          category,
          level,
          language,
          thumbnail,
          price,
          discount_price,
          currency,
          is_paid,
          lifetime_access,
          certificate_available,
          instructor_id,
          total_duration_minutes,
          enrolled_students,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          title,
          slug,
          subtitle,
          description,
          category,
          level,
          language,
          thumbnail,
          price,
          discountPrice,
          currency,
          isPaid,
          lifetimeAccess,
          certificateAvailable,
          instructorId,
          totalDurationMinutes,
          enrolledStudents,
        ]
      );

      return {
        status: 201,
        body: {
          message: 'Course created successfully',
          course: {
            id: result.insertId,
            title,
            slug,
            subtitle,
            description,
            category,
            level,
            language,
            thumbnail,
            price,
            discount_price: discountPrice,
            currency,
            is_paid: Boolean(isPaid),
            lifetime_access: Boolean(lifetimeAccess),
            certificate_available: Boolean(certificateAvailable),
            instructor_id: instructorId,
            total_duration_minutes: totalDurationMinutes,
            enrolled_students: enrolledStudents,
          },
        },
      };
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' && attempt === 0) {
        slug = await ensureUniqueSlug(`${slug}-${generateSlugSuffix()}`, title);
        continue;
      }
      throw err;
    }
  }
}

module.exports = {
  getPublishedCourses,
  getPublishedCourseDetailBySlug,
  createCourse,
};
