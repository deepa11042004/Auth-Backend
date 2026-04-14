const db = require('../config/db');
const authService = require('./authService');

const USERS_TABLE = 'users';
const WORKSHOP_LIST_TABLE = 'workshop_list';
const REGISTRATION_TABLE = 'workshop_registrations';

const USER_PROFILE_TABLE = 'user_profiles';
const WISHLIST_TABLE = 'user_workshop_wishlist';
const PROGRESS_TABLE = 'user_workshop_progress';
const SESSION_TABLE = 'user_workshop_sessions';

const SUCCESSFUL_PAYMENT_STATUSES = new Set(['captured', 'authorized', 'not_required']);

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

function toPositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
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

  const normalized = cleanText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function clampProgress(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (parsed <= 0) {
    return 0;
  }

  if (parsed >= 100) {
    return 100;
  }

  return Math.round(parsed);
}

function formatDateTime(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const asString = String(value).trim();
  return asString || null;
}

function normalizePaymentStatus(value) {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'cancelled' || normalized === 'canceled') {
    return 'failed';
  }

  return normalized;
}

function resolveWorkshopThumbnail(row, workshopId) {
  const thumbnailUrl = toNullableText(row.thumbnail_url);
  if (thumbnailUrl) {
    return thumbnailUrl;
  }

  if (row.thumbnail) {
    return `/api/workshop-list/${workshopId}/thumbnail`;
  }

  return null;
}

function resolveWorkshopCertificate(row, workshopId) {
  const certificateUrl = toNullableText(row.certificate_url);
  if (certificateUrl) {
    return certificateUrl;
  }

  if (row.certificate_file) {
    return `/api/workshop-list/${workshopId}/certificate`;
  }

  return null;
}

async function ensureDashboardTables(connection = db) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${USER_PROFILE_TABLE} (
      user_id INT PRIMARY KEY,
      phone VARCHAR(20) NULL,
      city VARCHAR(120) NULL,
      institution VARCHAR(180) NULL,
      bio TEXT NULL,
      profile_picture_url VARCHAR(500) NULL,
      notification_email TINYINT(1) NOT NULL DEFAULT 1,
      notification_workshop_updates TINYINT(1) NOT NULL DEFAULT 1,
      notification_marketing TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_profiles_updated_at (updated_at)
    )`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${WISHLIST_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      workshop_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_workshop_wishlist (user_id, workshop_id),
      INDEX idx_user_workshop_wishlist_user_id (user_id),
      INDEX idx_user_workshop_wishlist_workshop_id (workshop_id)
    )`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${PROGRESS_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      workshop_id INT NOT NULL,
      progress_percent INT NOT NULL DEFAULT 0,
      modules_completed INT NOT NULL DEFAULT 0,
      modules_total INT NOT NULL DEFAULT 10,
      status ENUM('not-started','ongoing','completed') NOT NULL DEFAULT 'ongoing',
      last_activity_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_workshop_progress (user_id, workshop_id),
      INDEX idx_user_workshop_progress_user_id (user_id),
      INDEX idx_user_workshop_progress_workshop_id (workshop_id)
    )`
  );

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${SESSION_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      workshop_id INT NOT NULL,
      session_title VARCHAR(200) NOT NULL,
      session_date DATETIME NULL,
      is_attended TINYINT(1) NOT NULL DEFAULT 0,
      meeting_link VARCHAR(500) NULL,
      recording_url VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_workshop_sessions_user_id (user_id),
      INDEX idx_user_workshop_sessions_workshop_id (workshop_id)
    )`
  );
}

async function getUserById(userId, connection = db) {
  const resolvedUserId = toPositiveInt(userId);
  if (!resolvedUserId) {
    return null;
  }

  const [rows] = await connection.query(
    `SELECT id, full_name, email, role, is_active, created_at, updated_at, last_login
     FROM ${USERS_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [resolvedUserId]
  );

  return rows[0] || null;
}

async function getWorkshopById(workshopId, connection = db) {
  const resolvedWorkshopId = toPositiveInt(workshopId);
  if (!resolvedWorkshopId) {
    return null;
  }

  const [rows] = await connection.query(
    `SELECT id, title, fee, thumbnail_url, thumbnail, certificate, certificate_url, certificate_file
     FROM ${WORKSHOP_LIST_TABLE}
     WHERE id = ?
     LIMIT 1`,
    [resolvedWorkshopId]
  );

  return rows[0] || null;
}

function mapWorkshopSummaryRow(row) {
  const workshopId = Number(row.workshop_id || row.id);
  const registrationStatus = normalizePaymentStatus(row.payment_status);
  const hasSuccessfulPayment = registrationStatus
    ? SUCCESSFUL_PAYMENT_STATUSES.has(registrationStatus)
    : true;

  const baseProgress = clampProgress(row.progress_percent);
  const inferredProgress = baseProgress > 0
    ? baseProgress
    : (hasSuccessfulPayment ? 20 : 0);

  const modulesTotalRaw = Number(row.modules_total);
  const modulesTotal = Number.isInteger(modulesTotalRaw) && modulesTotalRaw > 0
    ? modulesTotalRaw
    : 10;
  const modulesCompletedRaw = Number(row.modules_completed);
  const modulesCompleted = Number.isInteger(modulesCompletedRaw) && modulesCompletedRaw >= 0
    ? Math.min(modulesCompletedRaw, modulesTotal)
    : Math.round((inferredProgress / 100) * modulesTotal);

  const explicitStatus = cleanText(row.progress_status).toLowerCase();
  const resolvedStatus = explicitStatus === 'completed'
    ? 'completed'
    : inferredProgress >= 100
    ? 'completed'
    : inferredProgress > 0
    ? 'ongoing'
    : 'not-started';

  const title = cleanText(row.workshop_title || row.title) || `Workshop ${workshopId}`;

  return {
    workshop_id: workshopId,
    workshop_title: title,
    description: toNullableText(row.workshop_description || row.description),
    progress_percent: inferredProgress,
    modules_completed: modulesCompleted,
    modules_total: modulesTotal,
    status: resolvedStatus,
    payment_status: registrationStatus,
    payment_amount: row.payment_amount === null || row.payment_amount === undefined
      ? null
      : Number(row.payment_amount),
    payment_currency: toNullableText(row.payment_currency),
    enrolled_at: formatDateTime(row.enrolled_at || row.created_at),
    last_activity_at: formatDateTime(row.last_activity_at),
    continue_url: `/workshops/${workshopId}`,
    thumbnail_url: resolveWorkshopThumbnail(row, workshopId),
    certificate_available: Number(row.certificate || 0) === 1,
    certificate_url: resolveWorkshopCertificate(row, workshopId),
  };
}

function buildWorkshopRowsQuery(options = {}) {
  const includePaymentColumns = options.includePaymentColumns !== false;
  const includeAlternativeEmail = options.includeAlternativeEmail !== false;

  const paymentColumns = includePaymentColumns
    ? `
        wr.payment_status,
        wr.payment_amount,
        wr.payment_currency,`
    : '';

  const registrationEmailCondition = includeAlternativeEmail
    ? `
         LOWER(TRIM(email)) = ?
         OR LOWER(TRIM(COALESCE(alternative_email, ''))) = ?`
    : 'LOWER(TRIM(email)) = ?';

  return `SELECT
        wr.id AS registration_id,
        wr.workshop_id,${paymentColumns}
        wr.created_at AS enrolled_at,
        wl.title AS workshop_title,
        wl.description AS workshop_description,
        wl.thumbnail_url,
        wl.thumbnail,
        wl.certificate,
        wl.certificate_url,
        wl.certificate_file,
        uwp.progress_percent,
        uwp.modules_completed,
        uwp.modules_total,
        uwp.status AS progress_status,
        uwp.last_activity_at
       FROM ${REGISTRATION_TABLE} wr
       INNER JOIN (
         SELECT workshop_id, MAX(id) AS latest_id
         FROM ${REGISTRATION_TABLE}
         WHERE ${registrationEmailCondition}
         GROUP BY workshop_id
       ) latest ON latest.latest_id = wr.id
       LEFT JOIN ${WORKSHOP_LIST_TABLE} wl ON wl.id = wr.workshop_id
       LEFT JOIN ${PROGRESS_TABLE} uwp
         ON uwp.user_id = ?
        AND uwp.workshop_id = wr.workshop_id
       ORDER BY wr.id DESC`;
}

async function fetchUserWorkshopRows(userId, connection = db) {
  const user = await getUserById(userId, connection);

  if (!user) {
    return {
      user: null,
      workshops: [],
    };
  }

  const email = cleanText(user.email).toLowerCase();
  if (!email) {
    return {
      user,
      workshops: [],
    };
  }

  let rows = [];

  const queryAttempts = [
    { includePaymentColumns: true, includeAlternativeEmail: true },
    { includePaymentColumns: true, includeAlternativeEmail: false },
    { includePaymentColumns: false, includeAlternativeEmail: true },
    { includePaymentColumns: false, includeAlternativeEmail: false },
  ];

  for (const attempt of queryAttempts) {
    const query = buildWorkshopRowsQuery(attempt);
    const params = attempt.includeAlternativeEmail
      ? [email, email, Number(user.id)]
      : [email, Number(user.id)];

    try {
      const [queryRows] = await connection.query(query, params);
      rows = queryRows;
      break;
    } catch (err) {
      if (!err || err.code !== 'ER_BAD_FIELD_ERROR') {
        throw err;
      }
    }
  }

  return {
    user,
    workshops: rows.map(mapWorkshopSummaryRow),
  };
}

async function getRecommendedWorkshops(excludedWorkshopIds = [], connection = db) {
  const sanitizedIds = excludedWorkshopIds
    .map((id) => toPositiveInt(id))
    .filter((id) => Number.isInteger(id));

  let query = `SELECT id, title, description, mode, workshop_date, fee, thumbnail_url, thumbnail
               FROM ${WORKSHOP_LIST_TABLE}`;
  const params = [];

  if (sanitizedIds.length > 0) {
    query += ` WHERE id NOT IN (${sanitizedIds.map(() => '?').join(', ')})`;
    params.push(...sanitizedIds);
  }

  query += ' ORDER BY id DESC LIMIT 6';

  const [rows] = await connection.query(query, params);

  return rows.map((row) => {
    const id = Number(row.id);

    return {
      id,
      title: cleanText(row.title) || `Workshop ${id}`,
      description: toNullableText(row.description),
      mode: toNullableText(row.mode),
      workshop_date: formatDateTime(row.workshop_date),
      fee: row.fee === null || row.fee === undefined ? null : Number(row.fee),
      thumbnail_url: resolveWorkshopThumbnail(row, id),
      enroll_url: `/workshops/${id}`,
    };
  });
}

async function getUserProfile(userId) {
  await ensureDashboardTables();

  const user = await getUserById(userId);
  if (!user) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'User not found.',
      },
    };
  }

  const [profileRows] = await db.query(
    `SELECT
      phone,
      city,
      institution,
      bio,
      profile_picture_url,
      notification_email,
      notification_workshop_updates,
      notification_marketing,
      updated_at
     FROM ${USER_PROFILE_TABLE}
     WHERE user_id = ?
     LIMIT 1`,
    [Number(user.id)]
  );

  const profile = profileRows[0] || null;

  return {
    status: 200,
    body: {
      success: true,
      data: {
        id: Number(user.id),
        full_name: toNullableText(user.full_name),
        email: cleanText(user.email),
        role: cleanText(user.role) || 'user',
        phone: toNullableText(profile?.phone),
        city: toNullableText(profile?.city),
        institution: toNullableText(profile?.institution),
        bio: toNullableText(profile?.bio),
        profile_picture_url: toNullableText(profile?.profile_picture_url),
        settings: {
          notification_email: toBoolean(profile?.notification_email, true),
          notification_workshop_updates: toBoolean(profile?.notification_workshop_updates, true),
          notification_marketing: toBoolean(profile?.notification_marketing, false),
        },
        updated_at: formatDateTime(profile?.updated_at || user.updated_at),
      },
    },
  };
}

async function updateUserProfile(userId, payload = {}) {
  await ensureDashboardTables();

  const resolvedUserId = toPositiveInt(userId);
  if (!resolvedUserId) {
    return {
      status: 401,
      body: {
        success: false,
        message: 'Unauthorized user session.',
      },
    };
  }

  const existingUser = await getUserById(resolvedUserId);
  if (!existingUser) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'User not found.',
      },
    };
  }

  const nextFullName = cleanText(payload.full_name) || cleanText(existingUser.full_name);
  const nextPhone = toNullableText(payload.phone);
  const nextCity = toNullableText(payload.city);
  const nextInstitution = toNullableText(payload.institution);
  const nextBio = toNullableText(payload.bio);
  const nextProfilePictureUrl = toNullableText(payload.profile_picture_url);

  if (!nextFullName || nextFullName.length < 2) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'full_name must be at least 2 characters.',
      },
    };
  }

  await db.query(
    `UPDATE ${USERS_TABLE}
     SET full_name = ?
     WHERE id = ?
     LIMIT 1`,
    [nextFullName, resolvedUserId]
  );

  await db.query(
    `INSERT INTO ${USER_PROFILE_TABLE}
      (user_id, phone, city, institution, bio, profile_picture_url)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      phone = VALUES(phone),
      city = VALUES(city),
      institution = VALUES(institution),
      bio = VALUES(bio),
      profile_picture_url = VALUES(profile_picture_url),
      updated_at = CURRENT_TIMESTAMP`,
    [
      resolvedUserId,
      nextPhone,
      nextCity,
      nextInstitution,
      nextBio,
      nextProfilePictureUrl,
    ]
  );

  return getUserProfile(resolvedUserId);
}

async function changeUserPassword(userId, payload = {}) {
  const oldPassword = cleanText(payload.oldPassword);
  const newPassword = cleanText(payload.newPassword);

  return authService.changePassword(userId, oldPassword, newPassword);
}

async function listEnrolledWorkshops(userId) {
  await ensureDashboardTables();

  const result = await fetchUserWorkshopRows(userId);

  if (!result.user) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'User not found.',
      },
    };
  }

  const workshops = result.workshops;
  const recommended = await getRecommendedWorkshops(
    workshops.map((workshop) => workshop.workshop_id)
  );

  return {
    status: 200,
    body: {
      success: true,
      data: workshops,
      meta: {
        total: workshops.length,
      },
      recommended,
    },
  };
}

async function getCertificates(userId) {
  await ensureDashboardTables();

  const result = await fetchUserWorkshopRows(userId);

  if (!result.user) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'User not found.',
      },
    };
  }

  const certificates = result.workshops
    .filter((workshop) => workshop.certificate_available)
    .filter((workshop) => workshop.status === 'completed' || workshop.progress_percent >= 80)
    .map((workshop) => ({
      id: `CERT-${workshop.workshop_id}-${result.user.id}`,
      workshop_id: workshop.workshop_id,
      workshop_title: workshop.workshop_title,
      issued_at: workshop.last_activity_at || workshop.enrolled_at,
      preview_url: workshop.certificate_url || workshop.continue_url,
      download_url: workshop.certificate_url || workshop.continue_url,
      status: workshop.status,
    }));

  return {
    status: 200,
    body: {
      success: true,
      data: certificates,
      meta: {
        total: certificates.length,
      },
    },
  };
}

async function getWishlist(userId) {
  await ensureDashboardTables();

  const user = await getUserById(userId);
  if (!user) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'User not found.',
      },
    };
  }

  const [rows] = await db.query(
    `SELECT
      w.id,
      w.workshop_id,
      w.created_at,
      wl.title,
      wl.description,
      wl.mode,
      wl.workshop_date,
      wl.fee,
      wl.thumbnail_url,
      wl.thumbnail
     FROM ${WISHLIST_TABLE} w
     LEFT JOIN ${WORKSHOP_LIST_TABLE} wl ON wl.id = w.workshop_id
     WHERE w.user_id = ?
     ORDER BY w.created_at DESC, w.id DESC`,
    [Number(user.id)]
  );

  const data = rows.map((row) => {
    const workshopId = Number(row.workshop_id);

    return {
      id: Number(row.id),
      workshop_id: workshopId,
      workshop_title: cleanText(row.title) || `Workshop ${workshopId}`,
      description: toNullableText(row.description),
      mode: toNullableText(row.mode),
      workshop_date: formatDateTime(row.workshop_date),
      fee: row.fee === null || row.fee === undefined ? null : Number(row.fee),
      thumbnail_url: resolveWorkshopThumbnail(row, workshopId),
      created_at: formatDateTime(row.created_at),
      enroll_url: `/workshops/${workshopId}`,
    };
  });

  return {
    status: 200,
    body: {
      success: true,
      data,
      meta: {
        total: data.length,
      },
    },
  };
}

async function addWishlistItem(userId, workshopId) {
  await ensureDashboardTables();

  const resolvedUserId = toPositiveInt(userId);
  const resolvedWorkshopId = toPositiveInt(workshopId);

  if (!resolvedUserId) {
    return {
      status: 401,
      body: {
        success: false,
        message: 'Unauthorized user session.',
      },
    };
  }

  if (!resolvedWorkshopId) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'workshop_id must be a positive integer.',
      },
    };
  }

  const workshop = await getWorkshopById(resolvedWorkshopId);
  if (!workshop) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Workshop not found.',
      },
    };
  }

  await db.query(
    `INSERT INTO ${WISHLIST_TABLE} (user_id, workshop_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
    [resolvedUserId, resolvedWorkshopId]
  );

  return {
    status: 201,
    body: {
      success: true,
      message: 'Workshop saved to wishlist.',
      data: {
        workshop_id: resolvedWorkshopId,
      },
    },
  };
}

async function removeWishlistItem(userId, workshopId) {
  await ensureDashboardTables();

  const resolvedUserId = toPositiveInt(userId);
  const resolvedWorkshopId = toPositiveInt(workshopId);

  if (!resolvedUserId) {
    return {
      status: 401,
      body: {
        success: false,
        message: 'Unauthorized user session.',
      },
    };
  }

  if (!resolvedWorkshopId) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'workshopId must be a positive integer.',
      },
    };
  }

  const [result] = await db.query(
    `DELETE FROM ${WISHLIST_TABLE}
     WHERE user_id = ?
       AND workshop_id = ?
     LIMIT 1`,
    [resolvedUserId, resolvedWorkshopId]
  );

  if (!result.affectedRows) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Wishlist item not found.',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Workshop removed from wishlist.',
    },
  };
}

async function getProgressOverview(userId) {
  await ensureDashboardTables();

  const result = await fetchUserWorkshopRows(userId);
  if (!result.user) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'User not found.',
      },
    };
  }

  const workshops = result.workshops;
  const total = workshops.length;
  const completed = workshops.filter((item) => item.status === 'completed').length;
  const ongoing = workshops.filter((item) => item.status === 'ongoing').length;
  const notStarted = workshops.filter((item) => item.status === 'not-started').length;

  const averageProgress = total
    ? Math.round(
      workshops.reduce((sum, item) => sum + clampProgress(item.progress_percent), 0) / total
    )
    : 0;

  const timeline = workshops.map((workshop) => ({
    workshop_id: workshop.workshop_id,
    workshop_title: workshop.workshop_title,
    progress_percent: workshop.progress_percent,
    modules_completed: workshop.modules_completed,
    modules_total: workshop.modules_total,
    status: workshop.status,
    last_activity_at: workshop.last_activity_at || workshop.enrolled_at,
  }));

  return {
    status: 200,
    body: {
      success: true,
      data: {
        summary: {
          total_workshops: total,
          completed,
          ongoing,
          not_started: notStarted,
          average_progress: averageProgress,
        },
        timeline,
      },
    },
  };
}

async function getAttendance(userId) {
  await ensureDashboardTables();

  const resolvedUserId = toPositiveInt(userId);
  if (!resolvedUserId) {
    return {
      status: 401,
      body: {
        success: false,
        message: 'Unauthorized user session.',
      },
    };
  }

  const [rows] = await db.query(
    `SELECT
      s.id,
      s.workshop_id,
      s.session_title,
      s.session_date,
      s.is_attended,
      s.meeting_link,
      s.recording_url,
      s.updated_at,
      wl.title AS workshop_title
     FROM ${SESSION_TABLE} s
     LEFT JOIN ${WORKSHOP_LIST_TABLE} wl ON wl.id = s.workshop_id
     WHERE s.user_id = ?
     ORDER BY s.session_date DESC, s.id DESC`,
    [resolvedUserId]
  );

  let sessions = rows.map((row) => ({
    id: Number(row.id),
    workshop_id: toPositiveInt(row.workshop_id),
    workshop_title: cleanText(row.workshop_title) || `Workshop ${row.workshop_id}`,
    session_title: cleanText(row.session_title) || 'Session',
    session_date: formatDateTime(row.session_date),
    is_attended: toBoolean(row.is_attended, false),
    meeting_link: toNullableText(row.meeting_link),
    recording_url: toNullableText(row.recording_url),
    updated_at: formatDateTime(row.updated_at),
  }));

  if (sessions.length === 0) {
    const workshopsResult = await fetchUserWorkshopRows(resolvedUserId);
    sessions = workshopsResult.workshops.map((workshop) => ({
      id: Number(`${resolvedUserId}${workshop.workshop_id}`),
      workshop_id: workshop.workshop_id,
      workshop_title: workshop.workshop_title,
      session_title: 'Orientation Session',
      session_date: workshop.enrolled_at,
      is_attended: workshop.progress_percent > 0,
      meeting_link: workshop.continue_url,
      recording_url: null,
      updated_at: workshop.last_activity_at || workshop.enrolled_at,
    }));
  }

  const totalSessions = sessions.length;
  const attended = sessions.filter((item) => item.is_attended).length;

  return {
    status: 200,
    body: {
      success: true,
      data: sessions,
      summary: {
        total_sessions: totalSessions,
        attended,
        attendance_percent: totalSessions ? Math.round((attended / totalSessions) * 100) : 0,
      },
    },
  };
}

async function getDownloads(userId) {
  await ensureDashboardTables();

  const workshopsResult = await fetchUserWorkshopRows(userId);
  if (!workshopsResult.user) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'User not found.',
      },
    };
  }

  const certificatesResult = await getCertificates(userId);
  const certificates = certificatesResult.body?.data || [];

  const downloads = [];

  workshopsResult.workshops.forEach((workshop) => {
    downloads.push({
      id: `notes-${workshop.workshop_id}`,
      workshop_id: workshop.workshop_id,
      title: `Workshop Notes: ${workshop.workshop_title}`,
      type: 'notes',
      format: 'link',
      url: workshop.continue_url,
      added_at: workshop.last_activity_at || workshop.enrolled_at,
    });

    if (workshop.status === 'completed' && workshop.certificate_url) {
      downloads.push({
        id: `certificate-${workshop.workshop_id}`,
        workshop_id: workshop.workshop_id,
        title: `Certificate: ${workshop.workshop_title}`,
        type: 'certificate',
        format: 'image',
        url: workshop.certificate_url,
        added_at: workshop.last_activity_at || workshop.enrolled_at,
      });
    }
  });

  certificates.forEach((certificate) => {
    if (!downloads.find((item) => item.id === `certificate-${certificate.workshop_id}`)) {
      downloads.push({
        id: `certificate-${certificate.workshop_id}`,
        workshop_id: certificate.workshop_id,
        title: `Certificate: ${certificate.workshop_title}`,
        type: 'certificate',
        format: 'image',
        url: certificate.download_url,
        added_at: certificate.issued_at,
      });
    }
  });

  downloads.sort((a, b) => {
    const timeA = a.added_at ? new Date(a.added_at).getTime() : 0;
    const timeB = b.added_at ? new Date(b.added_at).getTime() : 0;
    return timeB - timeA;
  });

  return {
    status: 200,
    body: {
      success: true,
      data: downloads,
      meta: {
        total: downloads.length,
      },
    },
  };
}

async function getSettings(userId) {
  await ensureDashboardTables();

  const user = await getUserById(userId);
  if (!user) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'User not found.',
      },
    };
  }

  const [rows] = await db.query(
    `SELECT
      notification_email,
      notification_workshop_updates,
      notification_marketing,
      updated_at
     FROM ${USER_PROFILE_TABLE}
     WHERE user_id = ?
     LIMIT 1`,
    [Number(user.id)]
  );

  const profile = rows[0] || null;

  return {
    status: 200,
    body: {
      success: true,
      data: {
        notification_email: toBoolean(profile?.notification_email, true),
        notification_workshop_updates: toBoolean(profile?.notification_workshop_updates, true),
        notification_marketing: toBoolean(profile?.notification_marketing, false),
        updated_at: formatDateTime(profile?.updated_at),
      },
    },
  };
}

async function updateSettings(userId, payload = {}) {
  await ensureDashboardTables();

  const resolvedUserId = toPositiveInt(userId);
  if (!resolvedUserId) {
    return {
      status: 401,
      body: {
        success: false,
        message: 'Unauthorized user session.',
      },
    };
  }

  const notificationEmail = toBoolean(payload.notification_email, true);
  const notificationWorkshopUpdates = toBoolean(
    payload.notification_workshop_updates,
    true
  );
  const notificationMarketing = toBoolean(payload.notification_marketing, false);

  await db.query(
    `INSERT INTO ${USER_PROFILE_TABLE}
      (user_id, notification_email, notification_workshop_updates, notification_marketing)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      notification_email = VALUES(notification_email),
      notification_workshop_updates = VALUES(notification_workshop_updates),
      notification_marketing = VALUES(notification_marketing),
      updated_at = CURRENT_TIMESTAMP`,
    [
      resolvedUserId,
      notificationEmail ? 1 : 0,
      notificationWorkshopUpdates ? 1 : 0,
      notificationMarketing ? 1 : 0,
    ]
  );

  return getSettings(resolvedUserId);
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
  listEnrolledWorkshops,
  getCertificates,
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
  getProgressOverview,
  getAttendance,
  getDownloads,
  getSettings,
  updateSettings,
};
