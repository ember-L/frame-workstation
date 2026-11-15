const test = require('node:test');
const assert = require('node:assert/strict');
const { validateFfmpegBuild } = require('../src/distribution');

test('blocks an FFmpeg binary built with nonfree components', () => {
  assert.throws(() => validateFfmpegBuild('configuration: --enable-gpl --enable-nonfree'), /不可再分发/);
  assert.doesNotThrow(() => validateFfmpegBuild('configuration: --enable-gpl --enable-libx264'));
});
