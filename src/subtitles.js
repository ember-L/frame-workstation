function parseTime(value) {
  const match = /^(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})$/.exec(value);
  if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) throw new Error('字幕时间格式无效');
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}
function formatTime(seconds) {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}
function formatSrt(cues) {
  if (!Array.isArray(cues) || !cues.length) throw new Error('没有可导出的字幕');
  return cues.map((cue, i) => {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start || Math.round(cue.start * 1000) >= Math.round(cue.end * 1000) || typeof cue.text !== 'string' || !cue.text.trim()) throw new Error(`第 ${i + 1} 条字幕内容或时间无效`);
    return `${i + 1}\n${formatTime(cue.start)} --> ${formatTime(cue.end)}\n${cue.text.trim()}`;
  }).join('\n\n') + '\n';
}
function parseSrt(source) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('字幕文件为空');
  const cues = source.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/).map((block, i) => {
    const lines = block.split('\n');
    if (/^\d+$/.test(lines[0].trim())) lines.shift();
    const match = /^\s*(\S+)\s+-->\s+(\S+)\s*$/.exec(lines.shift() || '');
    if (!match) throw new Error(`第 ${i + 1} 条字幕时间格式无效`);
    return { start: parseTime(match[1]), end: parseTime(match[2]), text: lines.join('\n').trim() };
  });
  formatSrt(cues);
  return cues;
}
module.exports = { parseSrt, formatSrt };
