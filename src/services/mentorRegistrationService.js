const db = require('../config/db');

const MENTOR_REGISTRATION_TABLE = 'mentor_registrations';
const FILE_COLUMNS = new Set(['resume', 'profile_photo']);

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
  const columns = [
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

  const values = columns.map((column) => payload[column]);
  const placeholders = columns.map(() => '?').join(', ');

  const [result] = await db.query(
    `INSERT INTO ${MENTOR_REGISTRATION_TABLE} (${columns.join(', ')})
     VALUES (${placeholders})`,
    values
  );

  return Number(result.insertId);
}

async function getMentorById(id) {
  const [rows] = await db.query(
    `SELECT
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
      created_at
     FROM ${MENTOR_REGISTRATION_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  if (rows.length === 0) {
    return null;
  }

  return mapMentorDetails(rows[0]);
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
};
