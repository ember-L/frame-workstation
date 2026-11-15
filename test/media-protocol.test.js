const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { mediaResponse } = require('../src/media-protocol');

test('serves byte ranges with correct status and headers', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'frame-media-'));
  try {
    const file = path.join(dir, 'test.mp4'); await writeFile(file, '0123456789');
    let response = await mediaResponse(file, new Request('https://example.test/video', { headers: { Range: 'bytes=3-5' } }));
    assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), 'bytes 3-5/10'); assert.equal(response.headers.get('content-length'), '3'); assert.equal(await response.text(), '345');
    response = await mediaResponse(file, new Request('https://example.test/video', { headers: { Range: 'bytes=-3' } }));
    assert.equal(await response.text(), '789');
    response = await mediaResponse(file, new Request('https://example.test/video', { headers: { Range: 'bytes=99-' } }));
    assert.equal(response.status, 416); assert.equal(response.headers.get('content-range'), 'bytes */10');
    response = await mediaResponse(file, new Request('https://example.test/video'));
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-length'), '10'); assert.equal(await response.text(), '0123456789');
  } finally { await rm(dir, { recursive:true, force:true }); }
});
