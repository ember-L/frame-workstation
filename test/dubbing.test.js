const test = require('node:test');
const assert = require('node:assert/strict');
const { planDubbing } = require('../src/dubbing');
test('fits speech into subtitle timing with bounded acceleration', () => {
  assert.deepEqual(planDubbing([{start:1,end:3,text:'hello'},{start:4,end:5,text:'bye'}],[3,0.7]), [{delay:1000,tempo:1.5},{delay:4000,tempo:1}]);
  assert.throws(() => planDubbing([{start:0,end:1,text:'long'}],[1.6]), /第 1 条/);
  assert.throws(() => planDubbing([{start:0,end:2,text:'a'},{start:1,end:3,text:'b'}],[1,1]), /重叠/);
});
test('builds a delayed mix and preserves original audio at reduced volume', () => {
  const { buildMixArgs } = require('../src/dubbing');
  const args = buildMixArgs('/source.wav', ['/one.wav','/two.wav'], [{delay:1000,tempo:1.5},{delay:4000,tempo:1}], '/output.wav');
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /\[0:a\]volume=0\.25/);
  assert.match(graph, /\[1:a\]atempo=1\.5,adelay=1000:all=1/);
  assert.match(graph, /amix=inputs=3:duration=first:normalize=0/);
});
