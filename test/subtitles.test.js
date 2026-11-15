const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSrt, formatSrt } = require('../src/subtitles');

test('parses and exports multilingual timed captions', () => {
  const cues = parseSrt('\ufeff1\r\n00:00:01,250 --> 00:00:03,500\r\n你好\r\nHello\r\n\r\n2\r\n00:01:00,000 --> 00:01:01,200\r\n第二句\r\n');
  assert.deepEqual(cues, [{start:1.25,end:3.5,text:'你好\nHello'}, {start:60,end:61.2,text:'第二句'}]);
  assert.deepEqual(parseSrt(formatSrt(cues)), cues);
});

test('rejects malformed and reversed subtitle times', () => {
  assert.throws(() => parseSrt('1\n00:00:03,000 --> 00:00:02,000\ntext'), /时间/);
  assert.throws(() => parseSrt('1\n00:99:03,000 --> 00:99:04,000\ntext'), /时间/);
  assert.throws(() => formatSrt([{start:0,end:1,text:'  '}]), /字幕/);
});
