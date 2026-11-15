const $ = id => document.getElementById(id);
const video = $('video');
let duration = 0;
let busy = false;
let segments = [];
let selectedClip = 0;
let draggingPlayhead = false;
const time = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
function message(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
function renderTimeline() {
  const track = $('clip-track'); track.replaceChildren();
  const total = timelineDuration(segments);
  let offset = 0;
  segments.forEach((clip, index) => {
    const button = document.createElement('button');
    button.className = 'clip' + (index === selectedClip ? ' selected' : '');
    button.style.left = `${offset / total * 100}%`;
    button.style.width = `${(clip.end - clip.start) / total * 100}%`;
    offset += clip.end - clip.start;
    button.textContent = `片段 ${index + 1}`;
    button.title = `${time(clip.start)} – ${time(clip.end)}`;
    button.setAttribute('aria-label', `片段 ${index + 1}，${time(clip.start)} 到 ${time(clip.end)}`);
    button.setAttribute('aria-pressed', String(index === selectedClip));
    button.addEventListener('click', event => {
      selectedClip = index;
      if (event.detail) { const rect = track.getBoundingClientRect(); seek(timeAtPosition(event.clientX, rect.left, rect.width, timelineDuration(segments))); }
      track.querySelectorAll('.clip').forEach((item, i) => { item.classList.toggle('selected', i === selectedClip); item.setAttribute('aria-pressed', String(i === selectedClip)); });
    });
    button.addEventListener('dblclick', () => $('split').click());
    track.append(button);
  });
  $('remove-clip').disabled = busy || segments.length <= 1;
  $('split').disabled = busy || !duration;
  const kept = total / Number($('speed').value);
  $('playhead').max = total;
  updatePlayhead(toTimelineTime(segments, video.currentTime || 0));
  $('selection').textContent = `保留时长 ${time(kept)}`;
}
function seek(point) { video.currentTime = toSourceTime(segments, point); $('playhead').value = point; updatePlayhead(point); }
function updatePlayhead(point) { const total = timelineDuration(segments); $('playhead').value = point; $('playhead-marker').style.left = `${total ? point / total * 100 : 0}%`; $('duration').textContent = `${time(point / Number($('speed').value))} / ${time(total / Number($('speed').value))}`; }
$('playhead').addEventListener('pointerdown', () => { draggingPlayhead = true; });
window.addEventListener('pointerup', () => { if (draggingPlayhead) { draggingPlayhead = false; seek(Number($('playhead').value)); } });
window.addEventListener('pointercancel', () => { if (draggingPlayhead) { draggingPlayhead = false; seek(Number($('playhead').value)); } });
window.addEventListener('blur', () => { if (draggingPlayhead) { draggingPlayhead = false; seek(Number($('playhead').value)); } });
$('playhead').addEventListener('input', () => seek(Number($('playhead').value)));
$('split').addEventListener('click', () => {
  const point = video.currentTime;
  const previous = segments;
  segments = splitSegment(segments, point);
  if (segments === previous) { $('timeline-message').textContent = '请将播放头移到片段内部再拆分。'; return; }
  selectedClip = segments.findIndex(clip => clip.start === point);
  $('timeline-message').textContent = '已拆分片段。'; renderTimeline();
});
$('remove-clip').addEventListener('click', () => {
  const removed = segments[selectedClip];
  segments = removeSegment(segments, selectedClip);
  selectedClip = Math.min(selectedClip, segments.length - 1);
  if (video.currentTime >= removed.start && video.currentTime < removed.end) video.currentTime = segments[selectedClip].start;
  $('timeline-message').textContent = '已移除选中片段。'; renderTimeline();
});
async function openVideo() {
  try {
    const file = await window.frame.openVideo();
    if (!file) return;
    duration = 0;
    $('use-dubbing').checked = false; $('use-dubbing').disabled = true;
    segments = []; selectedClip = 0; $('playhead').disabled = true; renderTimeline();
    $('export').disabled = true;
    video.hidden = false; $('empty').hidden = true;
    $('filename').textContent = file.name;
    video.src = file.url; video.load(); message('');
  } catch (error) { message(error.message, true); }
}
$('open').addEventListener('click', openVideo);
$('empty-open').addEventListener('click', openVideo);
video.addEventListener('loadedmetadata', () => {
  duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) { message('无法读取视频时长。', true); return; }
  segments = [{start: 0, end: duration}]; selectedClip = 0;
  $('playhead').max = duration; $('playhead').value = 0; $('playhead').disabled = false; updatePlayhead(0);
  $('export').disabled = false; renderTimeline();
});
video.addEventListener('error', () => { duration = 0; segments = []; $('export').disabled = true; $('playhead').disabled = true; renderTimeline(); message('无法预览该视频；请尝试使用 MP4、MOV 或 WebM。', true); });
function syncPlayback() {
  if (!duration || draggingPlayhead || video.seeking) return;
  const current = video.currentTime || 0;
  const next = nextSourceTime(segments, current);
  if (next === null) { video.pause(); updatePlayhead(timelineDuration(segments)); return; }
  if (next !== current) { video.currentTime = next; return; }
  updatePlayhead(toTimelineTime(segments, current));
}
video.addEventListener('timeupdate', syncPlayback);
video.addEventListener('seeked', syncPlayback);
video.addEventListener('play', () => { const tick = () => { if (!video.paused && !video.ended) { syncPlayback(); requestAnimationFrame(tick); } }; requestAnimationFrame(tick); });
$('timeline-zoom').addEventListener('input', () => { const zoom = Number($('timeline-zoom').value); $('timeline-track').style.width = `${zoom * 100}%`; $('zoom-value').textContent = `${zoom}×`; });
$('speed').addEventListener('change', () => { video.playbackRate = Number($('speed').value); renderTimeline(); });
$('export').addEventListener('click', async () => {
  if (busy || !duration) return;
  busy = true; $('export').disabled = true; $('open').disabled = true; $('empty-open').disabled = true; renderTimeline();
  message('正在导出，请稍候…');
  try {
    const result = await window.frame.exportVideo({ segments, burnSubtitles: $('burn-subtitles').checked, useDubbing: $('use-dubbing').checked, cues: $('burn-subtitles').checked || $('use-dubbing').checked ? cues : undefined, speed: Number($('speed').value), height: $('height').value === 'original' ? 'original' : Number($('height').value), quality: $('quality').value, format: $('format').value });
    message(result.canceled ? '已取消导出。' : `导出完成：${result.path}`);
  } catch (error) { message(error.message, true); }
  finally { busy = false; $('export').disabled = false; $('open').disabled = false; $('empty-open').disabled = false; renderTimeline(); }
});

let cues = [];
let cueIndex = 0;
function setWorkspace(view) {
  const subtitles = view === 'subtitles';
  const dubbing = view === 'dubbing';
  $('subtitle-panel').hidden = !subtitles;
  $('dubbing-panel').hidden = !dubbing;
  document.querySelector('.timeline').hidden = subtitles || dubbing;
  for (const [id, active] of [['edit-tab', !subtitles && !dubbing], ['subtitle-tab', subtitles], ['dubbing-tab', dubbing]]) {
    $(id).classList.toggle('active', active);
    $(id).setAttribute('aria-pressed', String(active));
  }
}
$('edit-tab').addEventListener('click', () => setWorkspace('edit'));
$('subtitle-tab').addEventListener('click', () => setWorkspace('subtitles'));
$('dubbing-tab').addEventListener('click', () => setWorkspace('dubbing'));
$('cue-prev').addEventListener('click', () => { if (cueIndex > 0) { cueIndex--; renderCues(); } });
$('cue-next').addEventListener('click', () => { if (cueIndex < cues.length - 1) { cueIndex++; renderCues(); } });
function renderCues() {
  const list = $('cue-list');
  list.replaceChildren();
  $('cue-empty').hidden = cues.length > 0;
  $('save-srt').disabled = cues.length === 0;
  cueIndex = Math.max(0, Math.min(cueIndex, cues.length - 1));
  $('cue-count').textContent = cues.length ? `${cueIndex + 1} / ${cues.length}` : '0 / 0';
  $('cue-prev').disabled = cueIndex === 0 || !cues.length;
  $('cue-next').disabled = cueIndex >= cues.length - 1;
  cues.slice(cueIndex, cueIndex + 1).forEach((cue) => {
    const index = cueIndex;
    const row = document.createElement('div'); row.className = 'cue-row';
    const number = document.createElement('span'); number.textContent = String(index + 1);
    const startLabel = document.createElement('label'); startLabel.textContent = '开始（秒）';
    const endLabel = document.createElement('label'); endLabel.textContent = '结束（秒）';
    const start = document.createElement('input'); start.type = 'number'; start.min = '0'; start.step = '0.001'; start.value = cue.start;
    const end = document.createElement('input'); end.type = 'number'; end.min = '0'; end.step = '0.001'; end.value = cue.end;
    start.addEventListener('input', () => { cue.start = start.value === '' ? NaN : Number(start.value); });
    end.addEventListener('input', () => { cue.end = end.value === '' ? NaN : Number(end.value); });
    startLabel.append(start); endLabel.append(end);
    const text = document.createElement('textarea'); text.value = cue.text; text.setAttribute('aria-label', `第 ${index + 1} 条字幕文本`); text.addEventListener('input', () => { cue.text = text.value; });
    const remove = document.createElement('button'); remove.className = 'button'; remove.textContent = '删除'; remove.setAttribute('aria-label', `删除第 ${index + 1} 条字幕`); remove.addEventListener('click', () => { cues.splice(index, 1); renderCues(); });
    row.append(number, startLabel, endLabel, text, remove); list.append(row);
  });
}
$('import-srt').addEventListener('click', async () => {
  if (cues.length && !window.confirm('导入字幕会替换当前内容，请先保存。继续导入吗？')) return;
  try { const imported = await window.frame.importSubtitles(); if (imported) { cues = imported; cueIndex = 0; renderCues(); $('cue-message').textContent = '字幕已导入。'; } }
  catch (error) { $('cue-message').textContent = error.message; }
});
$('add-cue').addEventListener('click', () => {
  const start = cues.length ? cues[cues.length - 1].end : 0;
  cues.push({ start: Number.isFinite(start) ? start : 0, end: Number.isFinite(start) ? start + 2 : 2, text: '' }); cueIndex = cues.length - 1; renderCues();
});
$('save-srt').addEventListener('click', async () => {
  try { if (await window.frame.saveSubtitles(cues)) $('cue-message').textContent = '字幕已保存。'; }
  catch (error) { $('cue-message').textContent = error.message; }
});

renderCues();

$('transcribe').addEventListener('click', () => { $('transcribe-options').hidden = !$('transcribe-options').hidden; });
$('cancel-transcribe').addEventListener('click', () => { $('transcribe-options').hidden = true; $('api-key').value = ''; });
$('transcribe-mode').addEventListener('change', () => { $('api-key-label').hidden = $('transcribe-mode').value !== 'openai'; });
$('start-transcribe').addEventListener('click', async () => {
  if (!duration || busy) { $('cue-message').textContent = '请先导入视频。'; return; }
  if (cues.length && !window.confirm('识别结果会替换当前字幕，请先保存。继续吗？')) return;
  const options = {mode:$('transcribe-mode').value, key:$('api-key').value};
  busy = true; $('open').disabled = true; $('export').disabled = true; $('start-transcribe').disabled = true; renderTimeline();
  $('cue-message').textContent = '正在识别，请稍候…';
  try {
    const result = await window.frame.transcribeVideo(options);
    if (result) { cues = result; cueIndex = 0; renderCues(); $('cue-message').textContent = '识别完成，请检查字幕。'; }
    else $('cue-message').textContent = '已取消识别。';
  } catch (error) { $('cue-message').textContent = error.message; }
  finally { $('api-key').value = ''; busy = false; $('open').disabled = false; $('export').disabled = !duration; $('start-transcribe').disabled = false; renderTimeline(); }
});

$('dubbing-mode').addEventListener('change', () => { $('dubbing-key-label').hidden = $('dubbing-mode').value !== 'openai'; $('dubbing-voice-label').hidden = $('dubbing-mode').value !== 'openai'; });
$('start-dubbing').addEventListener('click', async () => {
  if (!duration || !cues.length || busy) { $('dubbing-message').textContent = '请先导入视频并准备字幕。'; return; }
  busy = true; $('open').disabled = true; $('export').disabled = true; $('start-dubbing').disabled = true; renderTimeline();
  $('dubbing-message').textContent = '正在生成配音，请稍候…';
  try {
    const ok = await window.frame.generateDubbing({mode:$('dubbing-mode').value,key:$('dubbing-key').value,voice:$('dubbing-voice').value,cues,duration});
    if (ok) { $('use-dubbing').disabled = false; $('use-dubbing').checked = true; $('dubbing-message').textContent = '配音已生成，导出时将自动混合。'; }
    else $('dubbing-message').textContent = '已取消配音。';
  } catch (error) { $('dubbing-message').textContent = error.message; }
  finally { $('dubbing-key').value = ''; busy = false; $('open').disabled = false; $('export').disabled = !duration; $('start-dubbing').disabled = false; renderTimeline(); }
});
