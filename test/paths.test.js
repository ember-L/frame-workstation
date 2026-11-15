const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { isSourcePath } = require('../src/paths');

test('detects a source selected through a directory symlink', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'frame-path-'));
  try {
    const source = path.join(dir, 'video.mp4');
    await fs.writeFile(source, 'original');
    await fs.symlink(dir, path.join(dir, 'alias'));
    assert.equal(await isSourcePath(source, path.join(dir, 'alias', 'video.mp4')), true);
    const link = path.join(dir, 'link.mp4');
    await fs.symlink(source, link);
    assert.equal(await isSourcePath(link, link), true);
    const hardLink = path.join(dir, 'hardlink.mp4');
    await fs.link(source, hardLink);
    assert.equal(await isSourcePath(source, hardLink), true);
    assert.equal(await isSourcePath(source, path.join(dir, 'new.mp4')), false);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
