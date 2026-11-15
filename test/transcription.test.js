const test=require('node:test');const assert=require('node:assert/strict');
const {segmentsToCues}=require('../src/transcription');
test('accepts timestamped recognition segments and removes empty segments',()=>{
 assert.deepEqual(segmentsToCues([{start:0,end:1.5,text:' 你好 '},{start:2,end:3,text:'  '}]),[{start:0,end:1.5,text:'你好'}]);
 assert.throws(()=>segmentsToCues([{start:2,end:1,text:'wrong'}]),/时间/);
 assert.throws(()=>segmentsToCues([]),/没有识别/);
});
