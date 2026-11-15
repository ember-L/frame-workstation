function segmentsToCues(segments) {
  if (!Array.isArray(segments)) throw new Error('识别结果缺少分段时间');
  const cues = segments.filter(s => typeof s.text === 'string' && s.text.trim()).map(s => ({start: s.start, end: s.end, text:s.text.trim()}));
  if (!cues.length) throw new Error('没有识别到语音');
  if (cues.some(c => !Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end <= c.start)) throw new Error('识别结果的时间无效');
  return cues;
}
module.exports = {segmentsToCues};
