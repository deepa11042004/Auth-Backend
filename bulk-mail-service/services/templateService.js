const { getTemplateById } = require('../db/templateRepository');
const { HttpError } = require('../utils/httpError');
const { renderTemplate, extractTemplateTokens } = require('../utils/templateRenderer');
const { requireObject, requirePositiveInteger } = require('../utils/validators');

const AUTO_TEMPLATE_HTML = '<p>Hello {{first_name}} {{last_name}}</p>';

async function getTemplateOrThrow(templateIdInput) {
  const templateId = requirePositiveInteger(templateIdInput, 'template_id');
  const template = await getTemplateById(templateId);

  if (!template) {
    throw new HttpError(404, `Template '${templateId}' was not found`);
  }

  return template;
}

function buildTemplateVariables(row, columnMapping) {
  const data = {};

  Object.entries(columnMapping).forEach(([templateVariable, columnName]) => {
    data[templateVariable] = row[columnName];
  });

  return data;
}

function renderTemplateContent(template, variables) {
  const subject = renderTemplate(template.subject || '', variables);
  const html = renderTemplate(template.html || '', variables);

  return {
    subject: subject.trim() || 'No Subject',
    html,
  };
}

async function previewTemplate(payload) {
  const template = await getTemplateOrThrow(payload.template_id || payload.templateId);
  const variables = requireObject(payload.variables || {}, 'variables');

  return {
    id: template.id,
    name: template.name,
    subject: renderTemplate(template.subject || '', variables),
    html: renderTemplate(template.html || '', variables),
    variables: extractTemplateTokens(`${template.subject || ''} ${template.html || ''}`),
  };
}

function renderAutoTemplate(firstName, lastName) {
  return renderTemplate(AUTO_TEMPLATE_HTML, {
    first_name: firstName || '',
    last_name: lastName || '',
  });
}

module.exports = {
  getTemplateOrThrow,
  buildTemplateVariables,
  renderTemplateContent,
  previewTemplate,
  renderAutoTemplate,
};
