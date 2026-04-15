require('dotenv').config();
const app = require('../src/app');
const { signToken } = require('../src/utils/jwt');

async function run() {
  const port = 5015;
  const server = app.listen(port);

  try {
    const token = signToken({ id: 1, role: 'admin' });
    const stamp = Date.now();

    const formData = new FormData();
    formData.append('title', `Delete Test Hero ${stamp}`);
    formData.append('subtitle', 'Delete endpoint smoke test');
    formData.append('media_type', 'image');
    formData.append('position', '999');
    formData.append('is_active', 'true');
    const fakePng = new Blob([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], { type: 'image/png' });
    formData.append('media', fakePng, 'delete-test.png');

    const createRes = await fetch(`http://127.0.0.1:${port}/api/admin/hero-slides`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const createBody = await createRes.json().catch(() => ({}));
    const createdId = Number(createBody?.data?.id || 0);

    const deleteRes = createdId
      ? await fetch(`http://127.0.0.1:${port}/api/admin/hero-slides/${createdId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      : null;

    const deleteBody = deleteRes ? await deleteRes.json().catch(() => ({})) : {};

    console.log(JSON.stringify({
      createStatus: createRes.status,
      createdId,
      deleteStatus: deleteRes ? deleteRes.status : 0,
      deleteMessage: deleteBody?.message || null,
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(JSON.stringify({ error: String(error && error.message ? error.message : error) }, null, 2));
  process.exit(1);
});
