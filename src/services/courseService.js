const db = require('../config/db');

const lmsDB = db.lmsDB;
const bsercDB = db.bsercDB || db;

const ALLOWED_LEVELS = new Set(['Beginner', 'Intermediate', 'Advanced']);
const ALLOWED_STATUSES = new Set(['draft', 'published', 'pending']);
const ALLOWED_VISIBILITY = new Set(['public', 'private', 'unlisted']);

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
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
    thumbnail: row.thumbnail,
    price: row.price === null ? 0 : Number(row.price),
    rating: Number(row.rating || 0),
    enrolledStudents: Number(row.enrolledStudents || 0),
  };
}

async function recalculateCourseStats(courseId) {
  await lmsDB.query(
    `UPDATE courses c
      SET c.total_lectures = (
        SELECT COUNT(*)
        FROM sections s
        JOIN lectures l ON l.section_id = s.id
        WHERE s.course_id = ?
      ),
      c.total_duration_minutes = (
        SELECT COALESCE(SUM(l.duration_minutes), 0)
        FROM sections s
        JOIN lectures l ON l.section_id = s.id
        WHERE s.course_id = ?
      )
     WHERE c.id = ?`,
    [courseId, courseId, courseId]
  );
}

async function getPublishedCourses({ page = 1, limit = 20 } = {}) {
  const safePage = toPositiveInt(page, 1);
  const safeLimit = Math.min(toPositiveInt(limit, 20), 100);
  const offset = (safePage - 1) * safeLimit;

  const [countRows] = await lmsDB.query(
    "SELECT COUNT(*) AS total FROM courses WHERE status = 'published'"
  );

  const [rows] = await lmsDB.query(
    `SELECT
      c.id,
      c.title,
      c.slug,
      COALESCE(c.thumbnail_medium, c.thumbnail_large, c.thumbnail_small) AS thumbnail,
      c.price,
      COALESCE(r.avg_rating, 0) AS rating,
      COALESCE(e.enrolled_students, 0) AS enrolledStudents
    FROM courses c
    LEFT JOIN (
      SELECT course_id, COUNT(*) AS enrolled_students
      FROM enrollments
      GROUP BY course_id
    ) e ON e.course_id = c.id
    LEFT JOIN (
      SELECT course_id, ROUND(AVG(rating), 1) AS avg_rating
      FROM ratings
      GROUP BY course_id
    ) r ON r.course_id = c.id
    WHERE c.status = 'published'
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
      c.description_short,
      c.description_long,
      c.category,
      c.level,
      c.language,
      COALESCE(c.thumbnail_medium, c.thumbnail_large, c.thumbnail_small) AS thumbnail,
      c.preview_video_url AS previewVideoUrl,
      c.price,
      c.is_paid AS isPaid,
      c.instructor_id AS instructorId,
      c.total_duration_minutes AS storedDuration,
      c.total_lectures AS storedLectures,
      COALESCE(r.avg_rating, 0) AS rating,
      COALESCE(e.enrolled_students, 0) AS enrolledStudents
    FROM courses c
    LEFT JOIN (
      SELECT course_id, ROUND(AVG(rating), 1) AS avg_rating
      FROM ratings
      GROUP BY course_id
    ) r ON r.course_id = c.id
    LEFT JOIN (
      SELECT course_id, COUNT(*) AS enrolled_students
      FROM enrollments
      GROUP BY course_id
    ) e ON e.course_id = c.id
    WHERE c.slug = ?
      AND c.status = 'published'
    LIMIT 1`,
    [safeSlug]
  );

  const course = courseRows[0];
  if (!course) {
    return null;
  }

  const [curriculumResult, requirementsResult, outcomesResult, instructorResult] = await Promise.all([
    lmsDB.query(
      `SELECT
        s.id AS sectionId,
        s.title AS sectionTitle,
        s.\`order\` AS sectionOrder,
        l.id AS lectureId,
        l.title AS lectureTitle,
        l.\`order\` AS lectureOrder,
        l.duration_minutes AS durationMinutes,
        l.video_url AS videoUrl,
        l.is_preview AS isPreview,
        lr.id AS resourceId,
        lr.type AS resourceType,
        lr.title AS resourceTitle,
        lr.url AS resourceUrl
      FROM sections s
      LEFT JOIN lectures l ON l.section_id = s.id
      LEFT JOIN lecture_resources lr ON lr.lecture_id = l.id
      WHERE s.course_id = ?
      ORDER BY
        COALESCE(s.\`order\`, 2147483647), s.id,
        COALESCE(l.\`order\`, 2147483647), l.id,
        lr.id`,
      [course.id]
    ),
    lmsDB.query('SELECT text FROM requirements WHERE course_id = ? ORDER BY id ASC', [course.id]),
    lmsDB.query('SELECT text FROM learning_outcomes WHERE course_id = ? ORDER BY id ASC', [course.id]),
    bsercDB.query('SELECT id, full_name FROM users WHERE id = ? LIMIT 1', [course.instructorId]),
  ]);

  const curriculumRows = curriculumResult[0];
  const requirementRows = requirementsResult[0];
  const outcomeRows = outcomesResult[0];
  const instructorRows = instructorResult[0];

  const sectionsMap = new Map();
  const lecturesBySection = new Map();
  const resourceIdsByLecture = new Map();

  let totalLectures = 0;
  let duration = 0;

  for (const row of curriculumRows) {
    if (!sectionsMap.has(row.sectionId)) {
      sectionsMap.set(row.sectionId, {
        id: row.sectionId,
        title: row.sectionTitle,
        order: row.sectionOrder === null ? null : Number(row.sectionOrder),
        lectures: [],
      });
      lecturesBySection.set(row.sectionId, new Map());
    }

    if (!row.lectureId) {
      continue;
    }

    const sectionLectures = lecturesBySection.get(row.sectionId);

    if (!sectionLectures.has(row.lectureId)) {
      const lecture = {
        id: row.lectureId,
        title: row.lectureTitle,
        order: row.lectureOrder === null ? null : Number(row.lectureOrder),
        durationMinutes: Number(row.durationMinutes || 0),
        videoUrl: row.videoUrl,
        isPreview: Boolean(row.isPreview),
        resources: [],
      };

      sectionsMap.get(row.sectionId).lectures.push(lecture);
      sectionLectures.set(row.lectureId, lecture);
      resourceIdsByLecture.set(row.lectureId, new Set());

      totalLectures += 1;
      duration += Number(row.durationMinutes || 0);
    }

    if (row.resourceId) {
      const seenResources = resourceIdsByLecture.get(row.lectureId);
      if (!seenResources.has(row.resourceId)) {
        sectionLectures.get(row.lectureId).resources.push({
          id: row.resourceId,
          type: row.resourceType,
          title: row.resourceTitle,
          url: row.resourceUrl,
        });
        seenResources.add(row.resourceId);
      }
    }
  }

  const instructor = instructorRows[0] || null;
  const computedDuration = duration > 0 ? duration : Number(course.storedDuration || 0);
  const computedLectureCount = totalLectures > 0 ? totalLectures : Number(course.storedLectures || 0);

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    description: {
      short: course.description_short,
      long: course.description_long,
    },
    category: course.category,
    level: course.level,
    language: course.language,
    thumbnail: course.thumbnail,
    previewVideoUrl: course.previewVideoUrl,
    price: course.price === null ? 0 : Number(course.price),
    isPaid: Boolean(course.isPaid),
    rating: Number(course.rating || 0),
    enrolledStudents: Number(course.enrolledStudents || 0),
    duration: computedDuration,
    totalLectures: computedLectureCount,
    requirements: requirementRows.map((item) => item.text).filter((item) => item),
    learningOutcomes: outcomeRows.map((item) => item.text).filter((item) => item),
    instructor: {
      id: instructor?.id || course.instructorId,
      name: instructor?.full_name || null,
      avatar: null,
    },
    curriculum: Array.from(sectionsMap.values()),
  };
}

async function createCourse(payload, authUser) {
  const title = cleanText(payload.title);
  const slug = cleanText(payload.slug);

  if (!title || !slug) {
    return { status: 400, body: { message: 'title and slug are required' } };
  }

  const subtitle = nullableText(payload.subtitle);
  const descriptionShort = nullableText(payload.description?.short ?? payload.description_short);
  const descriptionLong = nullableText(payload.description?.long ?? payload.description_long);
  const category = nullableText(payload.category);

  const level = nullableText(payload.level);
  if (level && !ALLOWED_LEVELS.has(level)) {
    return { status: 400, body: { message: 'Invalid level value' } };
  }

  const language = nullableText(payload.language);
  const thumbnail = nullableText(payload.thumbnail);
  const thumbnailSmall = nullableText(payload.thumbnail_small) || thumbnail;
  const thumbnailMedium = nullableText(payload.thumbnail_medium) || thumbnail || thumbnailSmall;
  const thumbnailLarge = nullableText(payload.thumbnail_large) || thumbnail || thumbnailMedium || thumbnailSmall;
  const previewVideoUrl = nullableText(payload.previewVideoUrl ?? payload.preview_video_url);

  const isPaid = toBoolean(payload.isPaid ?? payload.is_paid, true) ? 1 : 0;
  const rawPrice = toNullableNumber(payload.price);

  if (isPaid === 1 && rawPrice === null) {
    return { status: 400, body: { message: 'price is required for paid courses' } };
  }

  const price = rawPrice === null ? 0 : rawPrice;
  const discountPrice = toNullableNumber(payload.discountPrice ?? payload.discount_price);
  const currency = nullableText(payload.currency) || 'INR';

  const lifetimeAccess = toBoolean(payload.lifetimeAccess ?? payload.lifetime_access, true) ? 1 : 0;
  const certificateAvailable = toBoolean(payload.certificateAvailable ?? payload.certificate_available, true) ? 1 : 0;

  const status = nullableText(payload.status) || 'draft';
  if (!ALLOWED_STATUSES.has(status)) {
    return { status: 400, body: { message: 'Invalid status value' } };
  }

  const visibility = nullableText(payload.visibility) || 'public';
  if (!ALLOWED_VISIBILITY.has(visibility)) {
    return { status: 400, body: { message: 'Invalid visibility value' } };
  }

  const programId = toNullableInt(payload.programId ?? payload.program_id);

  let instructorId = toNullableInt(payload.instructorId ?? payload.instructor_id);
  if (!instructorId || authUser?.role === 'instructor') {
    instructorId = toNullableInt(authUser?.userId);
  }

  if (!instructorId) {
    return { status: 400, body: { message: 'Valid instructor_id is required' } };
  }

  const [instructorRows] = await bsercDB.query('SELECT id FROM users WHERE id = ? LIMIT 1', [instructorId]);
  if (!instructorRows[0]) {
    return { status: 404, body: { message: 'Instructor not found' } };
  }

  try {
    const [result] = await lmsDB.query(
      `INSERT INTO courses (
        title,
        slug,
        subtitle,
        description_short,
        description_long,
        category,
        level,
        language,
        thumbnail_small,
        thumbnail_medium,
        thumbnail_large,
        preview_video_url,
        price,
        discount_price,
        currency,
        is_paid,
        lifetime_access,
        certificate_available,
        status,
        visibility,
        instructor_id,
        program_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        title,
        slug,
        subtitle,
        descriptionShort,
        descriptionLong,
        category,
        level,
        language,
        thumbnailSmall,
        thumbnailMedium,
        thumbnailLarge,
        previewVideoUrl,
        price,
        discountPrice,
        currency,
        isPaid,
        lifetimeAccess,
        certificateAvailable,
        status,
        visibility,
        instructorId,
        programId,
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
          status,
          instructor_id: instructorId,
        },
      },
    };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return { status: 409, body: { message: 'slug already exists' } };
    }
    throw err;
  }
}

async function createSection(payload) {
  const courseId = toNullableInt(payload.course_id ?? payload.courseId);
  const title = cleanText(payload.title);
  const sectionOrder = toPositiveInt(payload.order, 1);

  if (!courseId || !title) {
    return { status: 400, body: { message: 'course_id and title are required' } };
  }

  const [courseRows] = await lmsDB.query('SELECT id FROM courses WHERE id = ? LIMIT 1', [courseId]);
  if (!courseRows[0]) {
    return { status: 404, body: { message: 'Course not found' } };
  }

  const [result] = await lmsDB.query(
    'INSERT INTO sections (course_id, title, `order`) VALUES (?, ?, ?)',
    [courseId, title, sectionOrder]
  );

  return {
    status: 201,
    body: {
      message: 'Section created successfully',
      section: {
        id: result.insertId,
        course_id: courseId,
        title,
        order: sectionOrder,
      },
    },
  };
}

async function createLecture(payload) {
  const sectionId = toNullableInt(payload.section_id ?? payload.sectionId);
  const title = cleanText(payload.title);
  const lectureOrder = toPositiveInt(payload.order, 1);
  const durationMinutes = toPositiveInt(payload.duration ?? payload.duration_minutes, 0);
  const videoUrl = nullableText(payload.video_url ?? payload.videoUrl);
  const isPreview = toBoolean(payload.isPreview ?? payload.is_preview, false) ? 1 : 0;

  if (!sectionId || !title) {
    return { status: 400, body: { message: 'section_id and title are required' } };
  }

  const [sectionRows] = await lmsDB.query(
    'SELECT id, course_id FROM sections WHERE id = ? LIMIT 1',
    [sectionId]
  );

  const section = sectionRows[0];
  if (!section) {
    return { status: 404, body: { message: 'Section not found' } };
  }

  const [result] = await lmsDB.query(
    'INSERT INTO lectures (section_id, title, `order`, duration_minutes, video_url, is_preview) VALUES (?, ?, ?, ?, ?, ?)',
    [sectionId, title, lectureOrder, durationMinutes, videoUrl, isPreview]
  );

  await recalculateCourseStats(section.course_id);

  return {
    status: 201,
    body: {
      message: 'Lecture created successfully',
      lecture: {
        id: result.insertId,
        section_id: sectionId,
        title,
        order: lectureOrder,
        durationMinutes,
        videoUrl,
        isPreview: Boolean(isPreview),
      },
    },
  };
}

async function enrollInCourse(payload, userId) {
  const safeUserId = toNullableInt(userId);
  if (!safeUserId) {
    return { status: 401, body: { message: 'Unauthorized' } };
  }

  const courseId = toNullableInt(payload.course_id ?? payload.courseId);
  if (!courseId) {
    return { status: 400, body: { message: 'course_id is required' } };
  }

  const [userRows] = await bsercDB.query('SELECT id FROM users WHERE id = ? LIMIT 1', [safeUserId]);
  if (!userRows[0]) {
    return { status: 404, body: { message: 'User not found' } };
  }

  const [courseRows] = await lmsDB.query(
    'SELECT id, status FROM courses WHERE id = ? LIMIT 1',
    [courseId]
  );

  const course = courseRows[0];
  if (!course) {
    return { status: 404, body: { message: 'Course not found' } };
  }

  if (course.status !== 'published') {
    return { status: 400, body: { message: 'Only published courses can be enrolled' } };
  }

  try {
    await lmsDB.query('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)', [safeUserId, courseId]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return { status: 409, body: { message: 'Already enrolled in this course' } };
    }
    throw err;
  }

  await lmsDB.query(
    'UPDATE courses SET enrolled_students = (SELECT COUNT(*) FROM enrollments WHERE course_id = ?) WHERE id = ?',
    [courseId, courseId]
  );

  return {
    status: 201,
    body: {
      message: 'Enrollment successful',
      enrollment: {
        user_id: safeUserId,
        course_id: courseId,
      },
    },
  };
}

module.exports = {
  getPublishedCourses,
  getPublishedCourseDetailBySlug,
  createCourse,
  createSection,
  createLecture,
  enrollInCourse,
};
