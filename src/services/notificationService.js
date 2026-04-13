const nodemailer = require('nodemailer');

let cachedTransporter = null;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseEmails(value) {
  return cleanText(value)
    .split(',')
    .map((email) => email.trim())
    .filter((email) => Boolean(email));
}

function getMailConfig() {
  return {
    host: cleanText(process.env.SMTP_HOST),
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    user: cleanText(process.env.SMTP_USER),
    pass: cleanText(process.env.SMTP_PASS),
    from: cleanText(process.env.HELPDESK_EMAIL_FROM) || cleanText(process.env.SMTP_USER),
    adminRecipients: parseEmails(process.env.HELPDESK_ADMIN_EMAILS),
  };
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = getMailConfig();
  if (!config.host || !config.user || !config.pass) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransporter;
}

async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter();
  const config = getMailConfig();

  if (!transporter || !config.from || !to || !subject) {
    return { sent: false, skipped: true };
  }

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      text,
      html,
    });

    return { sent: true };
  } catch (err) {
    console.error('Notification email error:', err);
    return { sent: false, error: err };
  }
}

async function sendTicketCreatedEmail({ userEmail, ticketId, subject, status }) {
  const config = getMailConfig();
  const mailTasks = [];

  if (userEmail) {
    mailTasks.push(
      sendMail({
        to: userEmail,
        subject: `Ticket #${ticketId} created successfully`,
        text: `Your support ticket has been created.\n\nTicket ID: ${ticketId}\nSubject: ${subject}\nCurrent status: ${status}`,
      })
    );
  }

  if (config.adminRecipients.length > 0) {
    mailTasks.push(
      sendMail({
        to: config.adminRecipients.join(','),
        subject: `New Help Desk Ticket #${ticketId}`,
        text: `A new ticket was created.\n\nTicket ID: ${ticketId}\nSubject: ${subject}\nStatus: ${status}`,
      })
    );
  }

  if (mailTasks.length > 0) {
    await Promise.allSettled(mailTasks);
  }
}

async function sendAdminReplyEmail({ userEmail, ticketId }) {
  if (!userEmail) {
    return;
  }

  await sendMail({
    to: userEmail,
    subject: `New admin reply on Ticket #${ticketId}`,
    text: `An admin has replied to your support ticket #${ticketId}. Please visit Help Desk to review the response.`,
  });
}

async function sendStatusChangedEmail({ userEmail, ticketId, status }) {
  if (!userEmail) {
    return;
  }

  await sendMail({
    to: userEmail,
    subject: `Ticket #${ticketId} status updated`,
    text: `Your support ticket #${ticketId} status is now: ${status}.`,
  });
}

module.exports = {
  sendTicketCreatedEmail,
  sendAdminReplyEmail,
  sendStatusChangedEmail,
};
