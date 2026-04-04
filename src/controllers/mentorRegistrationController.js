const mentorRegistrationService = require('../services/mentorRegistrationService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanText(value) {
  const candidate = firstValue(value);
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function toNullableText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
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

  const normalized = cleanText(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseNullableInt(value, fieldName, errors) {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return null;
  }

  const parsed = Number.parseInt(cleaned, 10);
  if (!Number.isInteger(parsed)) {
    errors.push(`${fieldName} must be an integer.`);
    return null;
  }

  return parsed;
}

function parseNullableDecimal(value, fieldName, errors) {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    errors.push(`${fieldName} must be a valid number.`);
    return null;
  }

  return parsed;
}

function isValidDateString(value) {
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

function parseMentorId(rawId) {
  const parsed = Number.parseInt(rawId, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
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

function detectImageMimeType(buffer) {
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

function buildMentorPayload(req) {
  const errors = [];

  const fullName = cleanText(req.body.full_name);
  const email = cleanText(req.body.email).toLowerCase();
  const phone = cleanText(req.body.phone);
  const dob = cleanText(req.body.dob);

  if (!fullName) {
    errors.push('full_name is required.');
  }

  if (!email) {
    errors.push('email is required.');
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push('email format is invalid.');
  }

  if (!phone) {
    errors.push('phone is required.');
  }

  if (!dob) {
    errors.push('dob is required.');
  } else if (!isValidDateString(dob)) {
    errors.push('dob must be a valid date in YYYY-MM-DD format.');
  }

  const payload = {
    full_name: fullName,
    email,
    phone,
    dob,
    current_position: toNullableText(req.body.current_position),
    organization: toNullableText(req.body.organization),
    years_experience: parseNullableInt(req.body.years_experience, 'years_experience', errors),
    professional_bio: toNullableText(req.body.professional_bio),
    primary_track: toNullableText(req.body.primary_track),
    secondary_skills: toNullableText(req.body.secondary_skills),
    key_competencies: toNullableText(req.body.key_competencies),
    video_call: toBoolean(req.body.video_call, false),
    phone_call: toBoolean(req.body.phone_call, false),
    live_chat: toBoolean(req.body.live_chat, false),
    email_support: toBoolean(req.body.email_support, false),
    availability: toNullableText(req.body.availability),
    max_students: parseNullableInt(req.body.max_students, 'max_students', errors),
    session_duration: toNullableText(req.body.session_duration),
    consultation_fee: parseNullableDecimal(req.body.consultation_fee, 'consultation_fee', errors),
    price_5_sessions: parseNullableDecimal(req.body.price_5_sessions, 'price_5_sessions', errors),
    price_10_sessions: parseNullableDecimal(req.body.price_10_sessions, 'price_10_sessions', errors),
    price_extended: parseNullableDecimal(req.body.price_extended, 'price_extended', errors),
    complimentary_session: toBoolean(req.body.complimentary_session, false),
    resume: req.files?.resume?.[0]?.buffer || null,
    profile_photo: req.files?.profile_photo?.[0]?.buffer || null,
    linkedin_url: toNullableText(req.body.linkedin_url),
    portfolio_url: toNullableText(req.body.portfolio_url),
    has_mentored_before: req.body.has_mentored_before === undefined
      ? null
      : toBoolean(req.body.has_mentored_before, false),
    mentoring_experience: toNullableText(req.body.mentoring_experience),
    accepted_guidelines: req.body.accepted_guidelines === undefined
      ? null
      : toBoolean(req.body.accepted_guidelines, false),
    accepted_code_of_conduct: req.body.accepted_code_of_conduct === undefined
      ? null
      : toBoolean(req.body.accepted_code_of_conduct, false),
  };

  return { payload, errors };
}

async function registerMentor(req, res) {
  try {
    const { payload, errors } = buildMentorPayload(req);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    const emailTaken = await mentorRegistrationService.isMentorEmailTaken(payload.email);
    if (emailTaken) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    await mentorRegistrationService.createMentorRegistration(payload);
    return res.status(201).json({ message: 'Mentor registered successfully' });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    console.error('Mentor registration error:', err);
    return res.status(500).json({ error: 'Failed to register mentor' });
  }
}

async function getMentorById(req, res) {
  try {
    const mentorId = parseMentorId(req.params.id);
    if (!mentorId) {
      return res.status(400).json({ error: 'Invalid mentor id.' });
    }

    const mentor = await mentorRegistrationService.getMentorById(mentorId);
    if (!mentor) {
      return res.status(404).json({ error: 'Mentor not found.' });
    }

    return res.status(200).json(mentor);
  } catch (err) {
    console.error('Mentor fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch mentor details' });
  }
}

async function sendMentorFile(req, res, options) {
  try {
    const mentorId = parseMentorId(req.params.id);
    if (!mentorId) {
      return res.status(400).json({ error: 'Invalid mentor id.' });
    }

    const result = await mentorRegistrationService.getMentorFileById(mentorId, options.column);
    if (!result.found) {
      return res.status(404).json({ error: 'Mentor not found.' });
    }

    if (!result.file) {
      return res.status(404).json({ error: options.missingMessage });
    }

    const mimeType = options.mimeResolver(result.file);
    const extension = extensionForMimeType(mimeType);

    res.set('Content-Type', mimeType);
    res.set('Content-Disposition', `inline; filename="mentor-${mentorId}-${options.filenamePrefix}.${extension}"`);

    return res.status(200).send(result.file);
  } catch (err) {
    console.error('Mentor file fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch mentor file' });
  }
}

async function getMentorResume(req, res) {
  return sendMentorFile(req, res, {
    column: 'resume',
    filenamePrefix: 'resume',
    missingMessage: 'Resume not found for this mentor.',
    mimeResolver: detectResumeMimeType,
  });
}

async function getMentorProfilePhoto(req, res) {
  return sendMentorFile(req, res, {
    column: 'profile_photo',
    filenamePrefix: 'profile-photo',
    missingMessage: 'Profile photo not found for this mentor.',
    mimeResolver: detectImageMimeType,
  });
}

async function getPendingMentors(req, res) {
  try {
    const mentors = await mentorRegistrationService.getPendingMentors();
    return res.status(200).json({ mentors });
  } catch (err) {
    console.error('Pending mentors fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch mentor requests' });
  }
}

async function getActiveMentors(req, res) {
  try {
    const mentors = await mentorRegistrationService.getActiveMentors();
    return res.status(200).json({ mentors });
  } catch (err) {
    console.error('Active mentors fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch mentor list' });
  }
}

async function approveMentor(req, res) {
  try {
    const mentorId = parseMentorId(req.params.id);
    if (!mentorId) {
      return res.status(400).json({ error: 'Invalid mentor id.' });
    }

    const result = await mentorRegistrationService.approveMentorById(mentorId);

    if (result.outcome === 'status_column_missing') {
      return res.status(500).json({
        error:
          "Mentor status is not configured. Apply migration: ALTER TABLE mentor_registrations ADD COLUMN status ENUM('pending', 'active') DEFAULT 'pending';",
      });
    }

    if (result.outcome === 'not_found') {
      return res.status(404).json({ error: 'Mentor not found.' });
    }

    if (result.outcome === 'already_active') {
      return res.status(409).json({
        error: 'Mentor is already active.',
        mentor: result.mentor || null,
      });
    }

    if (result.outcome === 'invalid_status') {
      return res.status(409).json({
        error: `Mentor cannot be approved from status: ${result.status}`,
      });
    }

    return res.status(200).json({
      message: 'Mentor approved successfully',
      mentor: result.mentor || null,
    });
  } catch (err) {
    console.error('Mentor approval error:', err);
    return res.status(500).json({ error: 'Failed to approve mentor' });
  }
}

async function rejectMentor(req, res) {
  try {
    const mentorId = parseMentorId(req.params.id);
    if (!mentorId) {
      return res.status(400).json({ error: 'Invalid mentor id.' });
    }

    const result = await mentorRegistrationService.rejectMentorById(mentorId);

    if (result.outcome === 'not_found') {
      return res.status(404).json({ error: 'Mentor not found.' });
    }

    return res.status(200).json({
      message: 'Mentor rejected and deleted successfully',
    });
  } catch (err) {
    console.error('Mentor rejection error:', err);
    return res.status(500).json({ error: 'Failed to reject mentor' });
  }
}

module.exports = {
  registerMentor,
  getMentorById,
  getMentorResume,
  getMentorProfilePhoto,
  getPendingMentors,
  getActiveMentors,
  approveMentor,
  rejectMentor,
};
