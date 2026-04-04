const db = require('../config/db');

const MENTOR_REGISTRATION_TABLE = 'mentor_registrations';
const FILE_COLUMNS = new Set(['resume', 'profile_photo']);
const MENTOR_STATUS_PENDING = 'pending';
const MENTOR_STATUS_ACTIVE = 'active';
const MENTOR_STATUS_BLOCKED = 'blocked';
const VALID_MENTOR_STATUSES = new Set([
  MENTOR_STATUS_PENDING,
  MENTOR_STATUS_ACTIVE,
  MENTOR_STATUS_BLOCKED,
]);

const MENTOR_DETAIL_COLUMNS = `
  id,
  full_name,
  email,
  phone,
  dob,
  current_position,
  organization,
  years_experience,
  professional_bio,
  primary_track,
  secondary_skills,
  key_competencies,
  video_call,
  phone_call,
  live_chat,
  email_support,
  availability,
  max_students,
  session_duration,
  consultation_fee,
  price_5_sessions,
  price_10_sessions,
  price_extended,
  complimentary_session,
  linkedin_url,
  portfolio_url,
  has_mentored_before,
  mentoring_experience,
  accepted_guidelines,
  accepted_code_of_conduct,
  (resume IS NOT NULL) AS has_resume,
  (profile_photo IS NOT NULL) AS has_profile_photo,
  created_at`;

function toBoolean(value) {
  return value === true || value === 1;
}

function mapMentorDetails(row) {
  return {
    id: Number(row.id),
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    dob: row.dob,
    current_position: row.current_position,
    organization: row.organization,
    years_experience: row.years_experience,
    professional_bio: row.professional_bio,
    primary_track: row.primary_track,
    secondary_skills: row.secondary_skills,
    key_competencies: row.key_competencies,
    video_call: toBoolean(row.video_call),
    phone_call: toBoolean(row.phone_call),
    live_chat: toBoolean(row.live_chat),
    email_support: toBoolean(row.email_support),
    availability: row.availability,
    max_students: row.max_students,
    session_duration: row.session_duration,
    consultation_fee: row.consultation_fee === null ? null : Number(row.consultation_fee),
    price_5_sessions: row.price_5_sessions === null ? null : Number(row.price_5_sessions),
    price_10_sessions: row.price_10_sessions === null ? null : Number(row.price_10_sessions),
    price_extended: row.price_extended === null ? null : Number(row.price_extended),
    complimentary_session: toBoolean(row.complimentary_session),
    linkedin_url: row.linkedin_url,
    portfolio_url: row.portfolio_url,
    has_mentored_before: row.has_mentored_before === null ? null : toBoolean(row.has_mentored_before),
    mentoring_experience: row.mentoring_experience,
    accepted_guidelines: row.accepted_guidelines === null ? null : toBoolean(row.accepted_guidelines),
    accepted_code_of_conduct: row.accepted_code_of_conduct === null
      ? null
      : toBoolean(row.accepted_code_of_conduct),
    status:
      typeof row.status === 'string' && row.status.trim()
        ? row.status
        : MENTOR_STATUS_PENDING,
    has_resume: toBoolean(row.has_resume),
    has_profile_photo: toBoolean(row.has_profile_photo),
    created_at: row.created_at,
  };
}

async function isMentorEmailTaken(email) {
  const [rows] = await db.query(
    `SELECT id
     FROM ${MENTOR_REGISTRATION_TABLE}
     WHERE LOWER(email) = LOWER(?)
     LIMIT 1`,
    [email]
  );

  return rows.length > 0;
}

async function createMentorRegistration(payload) {
  const baseColumns = [
    'full_name',
    'email',
    'phone',
    'dob',
    'current_position',
    'organization',
    'years_experience',
    'professional_bio',
    'primary_track',
    'secondary_skills',
    'key_competencies',
    'video_call',
    'phone_call',
    'live_chat',
    'email_support',
    'availability',
    'max_students',
    'session_duration',
    'consultation_fee',
    'price_5_sessions',
    'price_10_sessions',
    'price_extended',
    'complimentary_session',
    'resume',
    'profile_photo',
    'linkedin_url',
    'portfolio_url',
    'has_mentored_before',
    'mentoring_experience',
    'accepted_guidelines',
    'accepted_code_of_conduct',
  ];

  const baseValues = baseColumns.map((column) => payload[column]);

  let result;

  try {
    const columnsWithStatus = [...baseColumns, 'status'];
    const valuesWithStatus = [...baseValues, MENTOR_STATUS_PENDING];
    const placeholders = columnsWithStatus.map(() => '?').join(', ');

    [result] = await db.query(
      `INSERT INTO ${MENTOR_REGISTRATION_TABLE} (${columnsWithStatus.join(', ')})
       VALUES (${placeholders})`,
      valuesWithStatus
    );
  } catch (err) {
    // Keep registration backward compatible before status-column migration.
    if (!err || err.code !== 'ER_BAD_FIELD_ERROR') {
      throw err;
    }

    const placeholders = baseColumns.map(() => '?').join(', ');

    [result] = await db.query(
      `INSERT INTO ${MENTOR_REGISTRATION_TABLE} (${baseColumns.join(', ')})
       VALUES (${placeholders})`,
      baseValues
    );
  }

  return Number(result.insertId);
}

async function getMentorById(id) {
  let rows;

  try {
    [rows] = await db.query(
      `SELECT
        ${MENTOR_DETAIL_COLUMNS},
        status
       FROM ${MENTOR_REGISTRATION_TABLE}
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
  } catch (err) {
    if (!err || err.code !== 'ER_BAD_FIELD_ERROR') {
      throw err;
    }

    [rows] = await db.query(
      `SELECT
        ${MENTOR_DETAIL_COLUMNS}
       FROM ${MENTOR_REGISTRATION_TABLE}
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    rows = rows.map((row) => ({
      ...row,
      status: MENTOR_STATUS_PENDING,
    }));
  }

  if (rows.length === 0) {
    return null;
  }

  return mapMentorDetails(rows[0]);
}

async function getMentorsByStatus(status) {
  if (!VALID_MENTOR_STATUSES.has(status)) {
    return [];
  }

  let rows;

  try {
    [rows] = await db.query(
      `SELECT
        ${MENTOR_DETAIL_COLUMNS},
        status
       FROM ${MENTOR_REGISTRATION_TABLE}
       WHERE status = ?
       ORDER BY created_at DESC, id DESC`,
      [status]
    );
  } catch (err) {
    if (!err || err.code !== 'ER_BAD_FIELD_ERROR') {
      throw err;
    }

    // Graceful fallback for pre-migration environments.
    if (status === MENTOR_STATUS_ACTIVE || status === MENTOR_STATUS_BLOCKED) {
      return [];
    }

    [rows] = await db.query(
      `SELECT
        ${MENTOR_DETAIL_COLUMNS}
       FROM ${MENTOR_REGISTRATION_TABLE}
       ORDER BY created_at DESC, id DESC`
    );

    rows = rows.map((row) => ({
      ...row,
      status: MENTOR_STATUS_PENDING,
    }));
  }

  return rows.map(mapMentorDetails);
}

async function getMentorsByStatuses(statuses) {
  const uniqueStatuses = [...new Set(statuses.filter((status) => VALID_MENTOR_STATUSES.has(status)))];

  if (uniqueStatuses.length === 0) {
    return [];
  }

  let rows;

  try {
    const placeholders = uniqueStatuses.map(() => '?').join(', ');
    [rows] = await db.query(
      `SELECT
        ${MENTOR_DETAIL_COLUMNS},
        status
       FROM ${MENTOR_REGISTRATION_TABLE}
       WHERE status IN (${placeholders})
       ORDER BY created_at DESC, id DESC`,
      uniqueStatuses
    );
  } catch (err) {
    if (!err || err.code !== 'ER_BAD_FIELD_ERROR') {
      throw err;
    }

    if (!uniqueStatuses.includes(MENTOR_STATUS_PENDING)) {
      return [];
    }

    [rows] = await db.query(
      `SELECT
        ${MENTOR_DETAIL_COLUMNS}
       FROM ${MENTOR_REGISTRATION_TABLE}
       ORDER BY created_at DESC, id DESC`
    );

    rows = rows.map((row) => ({
      ...row,
      status: MENTOR_STATUS_PENDING,
    }));
  }

  return rows.map(mapMentorDetails);
}

async function getPendingMentors() {
  return getMentorsByStatuses([MENTOR_STATUS_PENDING, MENTOR_STATUS_BLOCKED]);
}

async function getActiveMentors() {
  return getMentorsByStatus(MENTOR_STATUS_ACTIVE);
}

async function approveMentorById(id) {
  try {
    const [rows] = await db.query(
      `SELECT id, status
       FROM ${MENTOR_REGISTRATION_TABLE}
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return { outcome: 'not_found' };
    }

    const currentStatus = String(rows[0].status || '').trim().toLowerCase();

    if (currentStatus === MENTOR_STATUS_ACTIVE) {
      const mentor = await getMentorById(id);
      return { outcome: 'already_active', mentor };
    }

    if (
      currentStatus
      && currentStatus !== MENTOR_STATUS_PENDING
      && currentStatus !== MENTOR_STATUS_BLOCKED
    ) {
      return { outcome: 'invalid_status', status: currentStatus };
    }

    await db.query(
      `UPDATE ${MENTOR_REGISTRATION_TABLE}
       SET status = ?
       WHERE id = ?`,
      [MENTOR_STATUS_ACTIVE, id]
    );

    const mentor = await getMentorById(id);

    return {
      outcome: 'approved',
      mentor,
    };
  } catch (err) {
    if (
      err
      && (
        err.code === 'ER_BAD_FIELD_ERROR'
        || err.code === 'WARN_DATA_TRUNCATED'
        || err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD'
      )
    ) {
      return { outcome: 'status_column_missing' };
    }

    throw err;
  }
}

async function blockMentorById(id) {
  try {
    const [rows] = await db.query(
      `SELECT id, status
       FROM ${MENTOR_REGISTRATION_TABLE}
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return { outcome: 'not_found' };
    }

    const currentStatus = String(rows[0].status || '').trim().toLowerCase();

    if (currentStatus === MENTOR_STATUS_BLOCKED) {
      const mentor = await getMentorById(id);
      return { outcome: 'already_blocked', mentor };
    }

    if (
      currentStatus
      && currentStatus !== MENTOR_STATUS_ACTIVE
      && currentStatus !== MENTOR_STATUS_PENDING
    ) {
      return { outcome: 'invalid_status', status: currentStatus };
    }

    await db.query(
      `UPDATE ${MENTOR_REGISTRATION_TABLE}
       SET status = ?
       WHERE id = ?`,
      [MENTOR_STATUS_BLOCKED, id]
    );

    const mentor = await getMentorById(id);

    return {
      outcome: 'blocked',
      mentor,
    };
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      return { outcome: 'status_column_missing' };
    }

    throw err;
  }
}

async function rejectMentorById(id) {
  const [result] = await db.query(
    `DELETE FROM ${MENTOR_REGISTRATION_TABLE}
     WHERE id = ?`,
    [id]
  );

  if (!result || Number(result.affectedRows || 0) === 0) {
    return { outcome: 'not_found' };
  }

  return { outcome: 'deleted' };
}

async function getMentorFileById(id, column) {
  if (!FILE_COLUMNS.has(column)) {
    throw new Error('Invalid file column');
  }

  const [rows] = await db.query(
    `SELECT ${column}
     FROM ${MENTOR_REGISTRATION_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  if (rows.length === 0) {
    return { found: false, file: null };
  }

  return {
    found: true,
    file: rows[0][column] || null,
  };
}

module.exports = {
  isMentorEmailTaken,
  createMentorRegistration,
  getMentorById,
  getMentorFileById,
  getPendingMentors,
  getActiveMentors,
  approveMentorById,
  blockMentorById,
  rejectMentorById,
};
