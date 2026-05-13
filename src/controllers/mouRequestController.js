const mouRequestService = require('../services/mouRequestService');

async function createMouRequest(req, res, next) {
  try {
    const result = await mouRequestService.submitMouRequest(req.body || {}, req.file || null);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function getMouRequests(req, res, next) {
  try {
    const result = await mouRequestService.listMouRequests();
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

async function deleteMouRequest(req, res, next) {
  try {
    const result = await mouRequestService.removeMouRequest(req.params.id);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
}

function toSafeFileName(value, fallback) {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input) {
    return fallback;
  }

  return input.replace(/[\r\n"]/g, '_');
}

async function downloadMouRequestDocument(req, res, next) {
  try {
    const result = await mouRequestService.fetchMouRequestDocument(req.params.id);

    if (!result.document) {
      return res.status(result.status).json(result.body);
    }

    const fileName = toSafeFileName(
      result.document.supporting_document_name,
      `mou-request-${req.params.id}.bin`,
    );

    const contentType = result.document.supporting_document_mime || 'application/octet-stream';
    const contentLength = Number.isFinite(result.document.supporting_document_size)
      && result.document.supporting_document_size > 0
      ? result.document.supporting_document_size
      : result.document.document_buffer.length;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', String(contentLength));

    return res.status(200).send(result.document.document_buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createMouRequest,
  getMouRequests,
  deleteMouRequest,
  downloadMouRequestDocument,
};