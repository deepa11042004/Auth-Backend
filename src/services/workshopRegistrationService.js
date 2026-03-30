const db = require('../config/db');

const REGISTRATION_TABLE = 'workshop_registrations';
const WORKSHOP_TABLE = 'workshop_list';
const DEFAULT_WORKSHOP_ID = 1;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_DESIGNATIONS = new Set(['Student', 'Faculty', 'Professional']);

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = cleanText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function normalizeDesignation(value) {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'student') {
    return 'Student';
  }
  if (normalized === 'faculty') {
    return 'Faculty';
  }
  if (normalized === 'professional') {
    return 'Professional';
  }
  return '';
}

function resolveWorkshopId() {
  return DEFAULT_WORKSHOP_ID;
}

async function registerForWorkshop(input) {
  const fullName = cleanText(input.full_name);
  const email = normalizeEmail(input.email);
  const contactNumber = cleanText(input.contact_number);
  const alternativeEmail = normalizeEmail(input.alternative_email) || null;
  const institution = cleanText(input.institution);
  const designation = normalizeDesignation(input.designation);
  const agreeRecording = toBoolean(input.agree_recording);
  const agreeTerms = toBoolean(input.agree_terms);
  const workshopId = resolveWorkshopId();

  if (!fullName || !email || !contactNumber || !institution || !designation) {
    return {
      status: 400,
      body: {
        message:
          'full_name, email, contact_number, institution and designation are required',
      },
    };
  }

  if (!EMAIL_REGEX.test(email)) {
    return {
      status: 400,
      body: { message: 'Invalid email format' },
    };
  }

  if (alternativeEmail && !EMAIL_REGEX.test(alternativeEmail)) {
    return {
      status: 400,
      body: { message: 'Invalid alternative_email format' },
    };
  }

  if (!ALLOWED_DESIGNATIONS.has(designation)) {
    return {
      status: 400,
      body: { message: 'designation must be Student, Faculty, or Professional' },
    };
  }

  if (!agreeRecording || !agreeTerms) {
    return {
      status: 400,
      body: { message: 'agree_recording and agree_terms must be true' },
    };
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [workshopRows] = await connection.query(
      `SELECT id FROM ${WORKSHOP_TABLE} WHERE id = ? LIMIT 1`,
      [workshopId]
    );

    if (!workshopRows[0]) {
      await connection.rollback();
      return {
        status: 404,
        body: { message: 'Workshop not found' },
      };
    }

    try {
      await connection.query(
        `INSERT INTO ${REGISTRATION_TABLE} (
          workshop_id,
          full_name,
          email,
          contact_number,
          alternative_email,
          institution,
          designation,
          agree_recording,
          agree_terms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workshopId,
          fullName,
          email,
          contactNumber,
          alternativeEmail,
          institution,
          designation,
          agreeRecording,
          agreeTerms,
        ]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        await connection.rollback();
        return {
          status: 409,
          body: { message: 'You have already registered for this workshop' },
        };
      }
      throw err;
    }

    await connection.commit();

    return {
      status: 201,
      body: {
        message: 'Workshop registration successful',
        registration: {
          workshop_id: workshopId,
          email,
        },
      },
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  registerForWorkshop,
};
