const QUALITY = { high: 18, medium: 23, low: 28 };
const HEIGHTS = new Set(['original', 1080, 720, 480]);
const FORMATS = {
  mp4: { video: 'libx264', audio: 'aac', ext: '.mp4', format: 'mp4' },
  mov: { video: 'libx264', audio: 'aac', ext: '.mov', format: 'mov' },
  webm: { video: 'libvpx-vp9', audio: 'libopus', ext: '.webm', format: 'webm' },
  gif: { ext: '.gif', format: 'gif' },
};

function buildExportArgs({ input, output, start, end, segments, speed = 1, height = 'original', quality = 'medium', format = 'mp4', hasAudio = false, subtitleFile, dubbingFile }) {
  if (!input || !output) throw new Error('缺少输入或输出文件');
  if (format === 'gif' && !segments) throw new Error('GIF 导出需要时间轴片段');
  if (!segments && (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start)) throw new Error('时间范围无效');
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) throw new Error('速度必须在 0.5 到 2 倍之间');
  if (!HEIGHTS.has(height)) throw new Error('分辨率无效');
  if (!Object.hasOwn(FORMATS, format)) throw new Error('格式不支持');
  if (!Object.hasOwn(QUALITY, quality)) throw new Error('质量无效');

  if (segments) {
    if (!Array.isArray(segments) || !segments.length || segments.length > 500 || segments.some((s,i) => !s || !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < 0 || s.end <= s.start || (i && s.start < segments[i-1].end))) throw new Error('片段时间范围无效');
    if (dubbingFile && !/^\/private\/tmp\/frame-dub-[a-f0-9-]+\.wav$/.test(dubbingFile)) throw new Error('配音路径无效');
    const audio = format !== 'gif' && (hasAudio === true || !!dubbingFile);
    const graph = [];
    if (subtitleFile) {
      if (typeof subtitleFile !== 'string' || !/^\/private\/tmp\/frame-sub-[a-f0-9-]+\.srt$/.test(subtitleFile)) throw new Error('字幕路径无效');
      graph.push(`[0:v:0]subtitles=filename='${subtitleFile}'${segments.length > 1 ? `,split=${segments.length}` : ''}${segments.map((_, i) => `[sub${i}]`).join('')}`);
    }
    segments.forEach((s,i) => {
      graph.push(`[${subtitleFile ? `sub${i}` : '0:v:0'}]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS[v${i}]`);
      if (audio) graph.push(`[${dubbingFile ? "1" : "0"}:a:0]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS[a${i}]`);
    });
    const inputs = segments.map((_,i) => `[v${i}]${audio ? `[a${i}]` : ''}`).join('');
    graph.push(`${inputs}concat=n=${segments.length}:v=1:a=${audio ? 1 : 0}[joined]${audio ? '[joinedAudio]' : ''}`);
    const scale = height === 'original' ? "scale=w='trunc(iw/2)*2':h='trunc(ih/2)*2'" : `scale=w='trunc(iw*min(1,${height}/ih)/2)*2':h='trunc(ih*min(1,${height}/ih)/2)*2'`;
    if (format === 'gif') graph.push(`[joined]setpts=PTS/${speed},${scale},fps=${quality === 'high' ? 20 : quality === 'medium' ? 15 : 10},split[palin][frames];[palin]palettegen[palette];[frames][palette]paletteuse[video]`);
    else graph.push(`[joined]setpts=PTS/${speed},${scale}[video]`);
    if (audio) graph.push(`[joinedAudio]atempo=${speed}[audio]`);
    const args = ['-hide_banner','-y','-i',input];
    if (dubbingFile && audio) args.push('-i', dubbingFile);
    args.push('-filter_complex',graph.join(';'),'-map','[video]');
    if (audio) args.push('-map','[audio]','-c:a',FORMATS[format].audio);
    else args.push('-an');
    if (format === 'gif') args.push('-loop','0');
    else if (format === 'webm') args.push('-c:v','libvpx-vp9','-b:v',`${quality === 'high' ? 6 : quality === 'medium' ? 3 : 1.5}M`);
    else args.push('-c:v','libx264','-crf',String(QUALITY[quality]),'-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart');
    args.push('-f',FORMATS[format].format,output);
    return args;
  }
  const codec = FORMATS[format];
  const filters = [`setpts=PTS/${speed}`];
  if (height === 'original') {
    filters.push("scale=w='trunc(iw/2)*2':h='trunc(ih/2)*2'");
  } else {
    filters.push(`scale=w='trunc(iw*min(1,${height}/ih)/2)*2':h='trunc(ih*min(1,${height}/ih)/2)*2'`);
  }
  const args = ['-hide_banner', '-y', '-ss', String(start), '-t', String(end - start), '-i', input, '-vf', filters.join(','), '-c:v', codec.video];
  if (format === 'webm') args.push('-b:v', `${quality === 'high' ? 6 : quality === 'medium' ? 3 : 1.5}M`);
  else args.push('-crf', String(QUALITY[quality]), '-preset', 'medium', '-pix_fmt', 'yuv420p');
  args.push('-map', '0:v:0', '-map', '0:a?', '-af', `atempo=${speed}`, '-c:a', codec.audio, '-movflags', '+faststart', '-f', codec.format, output);
  return args;
}

module.exports = { buildExportArgs, FORMATS };
