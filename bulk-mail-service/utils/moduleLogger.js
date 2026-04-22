const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
const logFilePath = path.join(logsDir, 'bulk-mail-service.log');

fs.mkdirSync(logsDir, { recursive: true });

function write(level, message, meta) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta: meta || undefined,
  };

  const line = `${JSON.stringify(payload)}\n`;
  fs.appendFile(logFilePath, line, () => {});

  if (level === 'error') {
    console.error(`[bulk-mail-service] ${message}`, meta || '');
    return;
  }

  if (level === 'warn') {
    console.warn(`[bulk-mail-service] ${message}`, meta || '');
    return;
  }

  console.log(`[bulk-mail-service] ${message}`, meta || '');
}

module.exports = {
  info(message, meta) {
    write('info', message, meta);
  },
  warn(message, meta) {
    write('warn', message, meta);
  },
  error(message, meta) {
    write('error', message, meta);
  },
};
