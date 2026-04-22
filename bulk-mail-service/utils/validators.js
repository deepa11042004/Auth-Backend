const { HttpError } = require('./httpError');

const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${fieldName} is required`);
  }

  return value.trim();
}

function requireObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `${fieldName} must be an object`);
  }

  return value;
}

function validateIdentifier(value, fieldName) {
  const normalized = requireNonEmptyString(value, fieldName);

  if (!IDENTIFIER_REGEX.test(normalized)) {
    throw new HttpError(400, `${fieldName} contains invalid characters`);
  }

  return normalized;
}

function quoteIdentifier(identifier) {
  const safe = validateIdentifier(identifier, 'SQL identifier');
  return `\`${safe}\``;
}

function validateEmail(email) {
  const normalized = requireNonEmptyString(email, 'email');

  if (!EMAIL_REGEX.test(normalized)) {
    throw new HttpError(400, 'email is not valid');
  }

  return normalized;
}

function requirePositiveInteger(value, fieldName) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new HttpError(400, `${fieldName} must be a positive integer`);
  }

  return numberValue;
}

module.exports = {
  requireNonEmptyString,
  requireObject,
  validateIdentifier,
  quoteIdentifier,
  validateEmail,
  requirePositiveInteger,
};
