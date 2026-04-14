const MouRequest = require('../models/MouRequest');

function parseMouRequestId(rawId) {
  const parsed = Number.parseInt(String(rawId || ''), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function submitMouRequest(payload, file) {
  await MouRequest.ensureMouRequestTable();

  const {
    payload: normalizedPayload,
    errors,
  } = MouRequest.normalizeMouRequestPayload(payload || {}, { file: file || null });

  if (errors.length > 0) {
    return {
      status: 400,
      body: {
        success: false,
        message: errors.join('. '),
        errors,
      },
    };
  }

  const request = await MouRequest.createMouRequest(normalizedPayload);

  return {
    status: 201,
    body: {
      success: true,
      message: 'MoU request submitted successfully',
      data: request,
    },
  };
}

async function listMouRequests() {
  await MouRequest.ensureMouRequestTable();

  const requests = await MouRequest.getMouRequests();

  return {
    status: 200,
    body: {
      success: true,
      data: requests,
    },
  };
}

async function removeMouRequest(rawId) {
  await MouRequest.ensureMouRequestTable();

  const id = parseMouRequestId(rawId);

  if (!id) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid MoU request id',
      },
    };
  }

  const wasDeleted = await MouRequest.deleteMouRequest(id);

  if (!wasDeleted) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'MoU request not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'MoU request deleted successfully',
    },
  };
}

async function fetchMouRequestDocument(rawId) {
  await MouRequest.ensureMouRequestTable();

  const id = parseMouRequestId(rawId);

  if (!id) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Invalid MoU request id',
      },
      document: null,
    };
  }

  const document = await MouRequest.getMouRequestDocumentById(id);

  if (!document) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'MoU request not found',
      },
      document: null,
    };
  }

  if (!document.supporting_document_data || document.supporting_document_data.length <= 0) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'No supporting document uploaded for this MoU request',
      },
      document: null,
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'MoU supporting document fetched successfully',
    },
    document,
  };
}

module.exports = {
  submitMouRequest,
  listMouRequests,
  removeMouRequest,
  fetchMouRequestDocument,
};