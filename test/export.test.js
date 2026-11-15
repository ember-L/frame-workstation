const test = require('node:test');
const assert = require('node:assert/strict');
const { buildExportArgs } = require('../src/export');

test('builds a trimmed, accelerated MP4 with bounded dimensions', () => {
  const args = buildExportArgs({ input: '/in.mp4', output: '/out.mp4', start: 2, end: 12, speed: 2, height: 720, quality: 'medium', format: 'mp4' });
  assert.equal(args[args.indexOf('-t') + 1], '10');
  assert.match(args[args.indexOf('-vf') + 1], /setpts=PTS\/2/);
  assert.match(args[args.indexOf('-vf') + 1], /min\(1,720\/ih\)/);
  assert.equal(args[args.indexOf('-c:v') + 1], 'libx264');
  assert.equal(args[args.indexOf('-af') + 1], 'atempo=2');
});

test('uses WebM codecs and rejects invalid ranges', () => {
  const options = { input: '/in.mp4', output: '/out.webm', start: 0, end: 5, speed: 1, height: 'original', quality: 'high', format: 'webm' };
  const args = buildExportArgs(options);
  assert.equal(args[args.indexOf('-c:v') + 1], 'libvpx-vp9');
  assert.throws(() => buildExportArgs({ ...options, end: 0 }), /时间/);
});

test('rejects inherited format and quality names', () => {
  const options = { input: '/in', output: '/out', start: 0, end: 5, speed: 1, height: 'original', quality: 'medium', format: 'mp4' };
  assert.throws(() => buildExportArgs({ ...options, format: 'toString' }), /格式/);
  assert.throws(() => buildExportArgs({ ...options, quality: 'toString' }), /质量/);
});

test('normalizes odd dimensions for original-size H.264 output', () => {
  const args = buildExportArgs({ input: '/in', output: '/out', start: 0, end: 1, speed: 1, height: 'original', quality: 'medium', format: 'mp4' });
  assert.match(args[args.indexOf('-vf') + 1], /trunc\(iw\/2\)\*2/);
});

test('concatenates kept pieces and applies speed to GIF without audio', () => {
  const args = buildExportArgs({ input:'/in.mp4', output:'/out.gif', segments:[{start:1,end:3},{start:5,end:8}], speed:2, height:480, quality:'medium', format:'gif', hasAudio:true });
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /trim=start=1:end=3/);
  assert.match(graph, /trim=start=5:end=8/);
  assert.match(graph, /concat=n=2:v=1:a=0/);
  assert.match(graph, /setpts=PTS\/2/);
  assert.ok(args.includes('-an'));
});

test('rejects overlapping pieces and builds silent video without audio filter', () => {
  const options={input:'/in.mp4',output:'/out.mp4',segments:[{start:0,end:2},{start:3,end:5}],speed:1,height:'original',quality:'medium',format:'mp4',hasAudio:false};
  assert.throws(() => buildExportArgs({...options, segments:[{start:0,end:3},{start:2,end:5}]}), /片段/);
  const args=buildExportArgs(options);
  assert.doesNotMatch(args[args.indexOf('-filter_complex')+1], /atrim/);
});

test('burns source-timed subtitles before cuts and speed changes', () => {
  const args = buildExportArgs({input:'/in',output:'/out',segments:[{start:0,end:2},{start:4,end:6}],speed:2,height:'original',quality:'medium',format:'mp4',subtitleFile:'/private/tmp/frame-sub-abcd.srt'});
  const graph = args[args.indexOf('-filter_complex')+1];
  assert.match(graph, /subtitles=filename='\/private\/tmp\/frame-sub-abcd.srt',split=2/);
  assert.match(graph, /\[sub0\]trim=start=0:end=2/);
  assert.match(graph, /\[sub1\]trim=start=4:end=6/);
  assert.match(graph, /setpts=PTS\/2/);
});

test('uses a generated dubbing track as source audio when exporting clips', () => {
  const args=buildExportArgs({input:'/in.mp4',output:'/out.mp4',segments:[{start:0,end:2}],speed:1,height:'original',quality:'medium',format:'mp4',hasAudio:true,dubbingFile:'/private/tmp/frame-dub-abcdef.wav'});
  assert.ok(args.includes('/private/tmp/frame-dub-abcdef.wav'));
  assert.match(args[args.indexOf('-filter_complex')+1], /\[1:a:0\]atrim=start=0:end=2/);
});
