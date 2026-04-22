const env = require('../config/env');
const { fetchRecipientsInChunks } = require('../db/recipientRepository');
const { validateIdentifier, requireNonEmptyString, validateEmail, requireObject } = require('../utils/validators');
const { addEmailJob, addBulkEmailJobs } = require('./queueService');
const {
  getTemplateOrThrow,
  buildTemplateVariables,
  renderTemplateContent,
  renderAutoTemplate,
} = require('./templateService');
const { HttpError } = require('../utils/httpError');

function pickValue(payload, keys) {
  for (const key of keys) {
    if (payload[key] !== undefined) {
      return payload[key];
    }
  }

  return undefined;
}

function normalizeColumnMapping(columnMappingInput) {
  const inputMapping = requireObject(columnMappingInput, 'column_mapping');
  const entries = Object.entries(inputMapping);

  if (!entries.length) {
    throw new HttpError(400, 'column_mapping cannot be empty');
  }

  const normalized = {};
  entries.forEach(([variableName, columnName]) => {
    const safeVariable = validateIdentifier(variableName, 'column_mapping key');
    const safeColumn = validateIdentifier(columnName, 'column_mapping value');
    normalized[safeVariable] = safeColumn;
  });

  return normalized;
}

function normalizeEmailFromRow(row, emailColumn) {
  const rawEmail = row[emailColumn];

  if (typeof rawEmail !== 'string') {
    return null;
  }

  const trimmedEmail = rawEmail.trim();
  return trimmedEmail || null;
}

async function queueSingleEmail(payload) {
  const email = validateEmail(payload.email);
  const subject = requireNonEmptyString(payload.subject, 'subject');
  const body = requireNonEmptyString(payload.body, 'body');

  const job = await addEmailJob({
    email,
    subject,
    html: body,
    mode: 'single',
  });

  return {
    queued: 1,
    jobId: String(job.id),
  };
}

async function queueBulkRaw(payload) {
  const tableName = validateIdentifier(
    pickValue(payload, ['tableName', 'table_name', 'table']),
    'table_name'
  );
  const emailColumn = validateIdentifier(
    pickValue(payload, ['emailColumn', 'email_column', 'email']),
    'email_column'
  );
  const subject = requireNonEmptyString(payload.subject, 'subject');
  const body = requireNonEmptyString(payload.body, 'body');

  let queued = 0;
  const sampleJobIds = [];

  await fetchRecipientsInChunks({
    tableName,
    columns: [emailColumn],
    chunkSize: env.queueFetchChunkSize,
    onChunk: async (rows) => {
      const payloads = [];

      rows.forEach((row) => {
        const email = normalizeEmailFromRow(row, emailColumn);
        if (!email) {
          return;
        }

        payloads.push({
          email,
          subject,
          html: body,
          mode: 'bulk_raw',
          tableName,
        });
      });

      const jobs = await addBulkEmailJobs(payloads, {
        jobIdPrefix: `raw-${tableName}`,
      });

      queued += jobs.length;

      jobs.forEach((job) => {
        if (sampleJobIds.length < 20) {
          sampleJobIds.push(String(job.id));
        }
      });
    },
  });

  return {
    queued,
    sampleJobIds,
  };
}

async function queueBulkAuto(payload) {
  const tableName = validateIdentifier(
    pickValue(payload, ['tableName', 'table_name', 'table']),
    'table_name'
  );
  const emailColumn = validateIdentifier(
    pickValue(payload, ['emailColumn', 'email_column', 'email']),
    'email_column'
  );
  const firstNameColumn = validateIdentifier(
    pickValue(payload, ['firstNameColumn', 'first_name_column', 'first_name']),
    'first_name_column'
  );
  const lastNameColumn = validateIdentifier(
    pickValue(payload, ['lastNameColumn', 'last_name_column', 'last_name']),
    'last_name_column'
  );

  const subject = payload.subject ? requireNonEmptyString(payload.subject, 'subject') : 'Greetings';

  let queued = 0;
  const sampleJobIds = [];

  await fetchRecipientsInChunks({
    tableName,
    columns: [emailColumn, firstNameColumn, lastNameColumn],
    chunkSize: env.queueFetchChunkSize,
    onChunk: async (rows) => {
      const payloads = [];

      rows.forEach((row) => {
        const email = normalizeEmailFromRow(row, emailColumn);

        if (!email) {
          return;
        }

        payloads.push({
          email,
          subject,
          html: renderAutoTemplate(row[firstNameColumn], row[lastNameColumn]),
          mode: 'bulk_auto',
          tableName,
        });
      });

      const jobs = await addBulkEmailJobs(payloads, {
        jobIdPrefix: `auto-${tableName}`,
      });

      queued += jobs.length;

      jobs.forEach((job) => {
        if (sampleJobIds.length < 20) {
          sampleJobIds.push(String(job.id));
        }
      });
    },
  });

  return {
    queued,
    sampleJobIds,
  };
}

async function queueBulkTemplate(payload) {
  const template = await getTemplateOrThrow(
    pickValue(payload, ['templateId', 'template_id'])
  );

  const tableName = validateIdentifier(
    pickValue(payload, ['tableName', 'table_name', 'table']),
    'table_name'
  );
  const mapping = normalizeColumnMapping(
    pickValue(payload, ['columnMapping', 'column_mapping'])
  );

  const emailColumnInput =
    pickValue(payload, ['emailColumn', 'email_column']) || mapping.email;
  const emailColumn = validateIdentifier(emailColumnInput, 'email_column');

  const columns = [emailColumn, ...Object.values(mapping)];

  let queued = 0;
  const sampleJobIds = [];

  await fetchRecipientsInChunks({
    tableName,
    columns,
    chunkSize: env.queueFetchChunkSize,
    onChunk: async (rows) => {
      const payloads = [];

      rows.forEach((row) => {
        const email = normalizeEmailFromRow(row, emailColumn);

        if (!email) {
          return;
        }

        const templateVariables = buildTemplateVariables(row, mapping);
        const rendered = renderTemplateContent(template, templateVariables);

        payloads.push({
          email,
          subject: rendered.subject,
          html: rendered.html,
          mode: 'bulk_template',
          tableName,
          templateId: template.id,
        });
      });

      const jobs = await addBulkEmailJobs(payloads, {
        jobIdPrefix: `template-${template.id}-${tableName}`,
      });

      queued += jobs.length;

      jobs.forEach((job) => {
        if (sampleJobIds.length < 20) {
          sampleJobIds.push(String(job.id));
        }
      });
    },
  });

  return {
    queued,
    template: {
      id: template.id,
      name: template.name,
    },
    sampleJobIds,
  };
}

module.exports = {
  queueSingleEmail,
  queueBulkRaw,
  queueBulkAuto,
  queueBulkTemplate,
};
