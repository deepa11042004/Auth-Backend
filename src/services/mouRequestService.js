const MouRequest = require('../models/MouRequest');
const {
  uploadMouSupportingDocument,
  streamMouSupportingDocument,
} = require('./s3StorageService');

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

  const hasFile = !!(file && Buffer.isBuffer(file.buffer) && file.buffer.length > 0);

  if (hasFile) {
    normalizedPayload.supporting_document_data = null;
    normalizedPayload.supporting_document_path = null;
    normalizedPayload.supporting_document_storage = 's3';
    normalizedPayload.migrated_from_blob = 0;
  }

  const request = await MouRequest.createMouRequest(normalizedPayload);

  if (hasFile && request && request.id) {
    try {
      const uploadResult = await uploadMouSupportingDocument({
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
        mouRequestId: String(request.id),
      });

      await MouRequest.updateMouRequestDocumentStorage(request.id, {
        supporting_document_name: file.originalname,
        supporting_document_mime: file.mimetype,
        supporting_document_size: file.size,
        supporting_document_data: null,
        supporting_document_path: uploadResult.s3Path,
        supporting_document_storage: 's3',
        migrated_from_blob: 0,
      });

      request.supporting_document_name = file.originalname || request.supporting_document_name;
      request.supporting_document_mime = file.mimetype || request.supporting_document_mime;
      request.supporting_document_size = Number.isFinite(Number(file.size))
        ? Number(file.size)
        : request.supporting_document_size;
      request.supporting_document_path = uploadResult.s3Path;
      request.supporting_document_storage = 's3';
      request.migrated_from_blob = false;
    } catch (err) {
      await MouRequest.deleteMouRequest(request.id).catch(() => {});
      return {
        status: 502,
        body: {
          success: false,
          message: 'Failed to upload supporting document to storage',
        },
      };
    }
  }

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

  if (document.supporting_document_path) {
    try {
      const streamed = await streamMouSupportingDocument({
        s3Path: document.supporting_document_path,
      });

      return {
        status: 200,
        body: {
          success: true,
          message: 'MoU supporting document fetched successfully',
        },
        document: {
          ...document,
          supporting_document_data: streamed.buffer,
          supporting_document_mime: document.supporting_document_mime || streamed.contentType,
          supporting_document_size: document.supporting_document_size
            || (Number.isFinite(streamed.contentLength) ? Number(streamed.contentLength) : streamed.buffer.length),
          served_from: 's3',
        },
      };
    } catch (err) {
      // Keep legacy documents accessible while S3 backfill stabilizes.
      console.warn(
        `MoU document S3 fetch failed for id=${id}, path=${document.supporting_document_path}: ${err.message || err}`,
      );
    }
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
    document: {
      ...document,
      served_from: 'blob',
    },
  };
}

module.exports = {
  submitMouRequest,
  listMouRequests,
  removeMouRequest,
  fetchMouRequestDocument,
};