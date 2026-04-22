const { SendEmailCommand } = require('@aws-sdk/client-ses');
const sesClient = require('../config/sesClient');
const env = require('../config/env');
const { HttpError } = require('../utils/httpError');
const { requireNonEmptyString, validateEmail } = require('../utils/validators');

async function sendEmail(email, subject, html) {
  const toEmail = validateEmail(email);
  const safeSubject = requireNonEmptyString(subject, 'subject');
  const safeHtml = requireNonEmptyString(html, 'body');

  if (!env.emailFrom) {
    throw new HttpError(500, 'EMAIL_FROM environment variable is required');
  }

  const command = new SendEmailCommand({
    Source: env.emailFrom,
    Destination: {
      ToAddresses: [toEmail],
    },
    Message: {
      Subject: {
        Charset: 'UTF-8',
        Data: safeSubject,
      },
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: safeHtml,
        },
      },
    },
  });

  return sesClient.send(command);
}

module.exports = {
  sendEmail,
};
