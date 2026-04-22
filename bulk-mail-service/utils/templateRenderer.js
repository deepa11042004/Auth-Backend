const TEMPLATE_TOKEN_REGEX = /{{\s*([A-Za-z0-9_]+)\s*}}/g;

function renderTemplate(template, data) {
  const input = typeof template === 'string' ? template : '';
  const values = data && typeof data === 'object' ? data : {};

  return input.replace(TEMPLATE_TOKEN_REGEX, (token, key) => {
    const value = values[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function extractTemplateTokens(template) {
  const input = typeof template === 'string' ? template : '';
  const tokens = new Set();
  let match = TEMPLATE_TOKEN_REGEX.exec(input);

  while (match) {
    tokens.add(match[1]);
    match = TEMPLATE_TOKEN_REGEX.exec(input);
  }

  TEMPLATE_TOKEN_REGEX.lastIndex = 0;
  return Array.from(tokens);
}

module.exports = {
  renderTemplate,
  extractTemplateTokens,
};
