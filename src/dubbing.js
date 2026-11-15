const { formatSrt } = require('./subtitles');
function planDubbing(cues, durations) {
  formatSrt(cues);
  if (!Array.isArray(durations) || durations.length !== cues.length) throw new Error('配音片段数量不匹配');
  return cues.map((cue, index) => {
    if (index && cue.start < cues[index - 1].end) throw new Error(`第 ${index + 1} 条字幕与上一条重叠，请先调整时间`);
    const duration = durations[index];
    if (!Number.isFinite(duration) || duration <= 0) throw new Error(`第 ${index + 1} 条配音时长无效`);
    const tempo = Math.max(1, duration / (cue.end - cue.start));
    if (tempo > 1.5) throw new Error(`第 ${index + 1} 条配音过长，请缩短字幕或延长时间`);
    return { delay: Math.round(cue.start * 1000), tempo };
  });
}
function buildMixArgs(source, files, plan, output) {
  if (!source || !output || !Array.isArray(files) || !files.length || !Array.isArray(plan) || files.length !== plan.length) throw new Error('配音输入无效');
  const args = ['-hide_banner', '-y', '-i', source];
  files.forEach(file => args.push('-i', file));
  const filters = ['[0:a]volume=0.25[original]'];
  plan.forEach(({delay, tempo}, i) => {
    if (!Number.isSafeInteger(delay) || delay < 0 || !Number.isFinite(tempo) || tempo < 1 || tempo > 1.5) throw new Error('配音时间参数无效');
    filters.push(`[${i+1}:a]atempo=${tempo},adelay=${delay}:all=1[voice${i}]`);
  });
  filters.push(`[original]${plan.map((_,i)=>`[voice${i}]`).join('')}amix=inputs=${plan.length+1}:duration=first:normalize=0[mix]`);
  args.push('-filter_complex', filters.join(';'), '-map', '[mix]', '-c:a', 'pcm_s16le', output);
  return args;
}
module.exports = { planDubbing, buildMixArgs };
