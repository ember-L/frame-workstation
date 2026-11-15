const test = require('node:test');
const assert = require('node:assert/strict');
const { splitSegment, removeSegment } = require('../src/timeline');
test('splits only within a kept segment and removes selected pieces', () => {
  const original = [{start:0,end:10}];
  const split = splitSegment(original, 4);
  assert.deepEqual(split, [{start:0,end:4},{start:4,end:10}]);
  assert.deepEqual(splitSegment(split, 4), split);
  assert.deepEqual(removeSegment(split,0), [{start:4,end:10}]);
  assert.deepEqual(removeSegment(original,0), original);
});

test('maps a pointer position to a clamped time along the track', () => {
  const { timeAtPosition } = require('../src/timeline');
  assert.equal(timeAtPosition(250, 100, 300, 20), 10);
  assert.equal(timeAtPosition(50, 100, 300, 20), 0);
  assert.equal(timeAtPosition(500, 100, 300, 20), 20);
});

test('maps joined timeline to source and back across deleted gaps', () => {
  const { timelineDuration, toSourceTime, toTimelineTime, nextSourceTime } = require('../src/timeline');
  const clips = [{start:1,end:3},{start:7,end:10}];
  assert.equal(timelineDuration(clips),5);
  assert.equal(toSourceTime(clips,2),7);
  assert.equal(toSourceTime(clips,3),8);
  assert.equal(toTimelineTime(clips,8),3);
  assert.equal(toTimelineTime(clips,5),2);
  assert.equal(nextSourceTime(clips,3.2),7);
  assert.equal(nextSourceTime(clips,10),null);
});
