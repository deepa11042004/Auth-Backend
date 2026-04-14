require('dotenv').config();
const db = require('../src/config/db');

const baseUrl = 'http://127.0.0.1:5001';

async function run() {
  const stamp = Date.now();
  const formData = new FormData();

  formData.append('institutionName', 'Blob Test Institute');
  formData.append('registeredAddress', '1 Test Street, Delhi 110001');
  formData.append('signatoryName', 'Blob Test Signatory');
  formData.append('designation', 'Director');
  formData.append('officialEmail', `mou.blob.${stamp}@example.com`);
  formData.append('officialPhone', '+91 9876543210');
  formData.append('alternativeEmail', 'alt.blob@example.com');
  formData.append('proposalPurpose', 'This proposal is for validating BLOB-based document storage in MoU flow with direct upload from the user form and internal review by the admin panel team over a structured collaboration period.');

  const fakePdf = new Blob(
    [Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF')],
    { type: 'application/pdf' }
  );
  formData.append('supportingDocument', fakePdf, 'blob-test.pdf');

  const createRes = await fetch(`${baseUrl}/api/mou-requests`, {
    method: 'POST',
    body: formData,
  });

  const createBody = await createRes.json().catch(() => ({}));

  const listRes = await fetch(`${baseUrl}/api/mou-requests`);
  const listBody = await listRes.json().catch(() => ({}));

  const createdId = createBody?.data?.id || null;

  let blobSize = null;
  if (createdId) {
    const [rows] = await db.query(
      'SELECT OCTET_LENGTH(supporting_document_data) AS blob_size FROM mou_requests WHERE id = ? LIMIT 1',
      [createdId]
    );
    blobSize = rows?.[0]?.blob_size ?? null;
  }

  console.log(JSON.stringify({
    createStatus: createRes.status,
    createSuccess: Boolean(createBody?.success),
    createdId,
    blobSize,
    listStatus: listRes.status,
    listCount: Array.isArray(listBody?.data) ? listBody.data.length : 0,
  }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({ error: String(error && error.message ? error.message : error) }, null, 2));
  process.exit(1);
});
