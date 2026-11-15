const { app, BrowserWindow, dialog, ipcMain, protocol } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { mediaResponse } = require('./media-protocol');
const { buildExportArgs, FORMATS } = require('./export');
const { isSourcePath } = require('./paths');
const { parseSrt, formatSrt } = require('./subtitles');
const { segmentsToCues } = require('./transcription');
const { planDubbing, buildMixArgs } = require('./dubbing');

protocol.registerSchemesAsPrivileged([{ scheme: 'frame-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
let selectedFile;
let exporting = false;
let dubbingFile;
let dubbingCues;

app.whenReady().then(() => {
  protocol.handle('frame-media', request => {
    if (!selectedFile || new URL(request.url).hostname !== 'selected') return new Response('Not found', { status: 404 });
    return mediaResponse(selectedFile, request);
  });
  const window = new BrowserWindow({ width: 1440, height: 920, minWidth: 1000, minHeight: 720, title: 'Frame Workstation', backgroundColor: '#101114', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.loadFile(path.join(__dirname, 'index.html'));
  ipcMain.handle('open-video', async () => {
    if (exporting) throw new Error('导出完成后才能更换视频');
    const result = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: '视频', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'] }] });
    if (result.canceled || !result.filePaths.length) return null;
    if (dubbingFile) await fs.rm(dubbingFile, { force: true });
    dubbingFile = undefined; dubbingCues = undefined;
    selectedFile = result.filePaths[0];
    return { name: path.basename(selectedFile), url: `frame-media://selected/video?version=${Date.now()}` };
  });
  ipcMain.handle('transcribe-video', async (_event, options) => {
    if (!selectedFile) throw new Error('请先导入视频');
    if (exporting) throw new Error('已有任务正在进行');
    if (!options || !['local', 'openai'].includes(options.mode)) throw new Error('识别模式无效');
    if (options.mode === 'openai' && (typeof options.key !== 'string' || !options.key.trim())) throw new Error('请输入 OpenAI API 密钥');
    exporting = true;
    const prefix = `/private/tmp/frame-transcribe-${randomUUID()}`;
    const audio = `${prefix}.${options.mode === 'local' ? 'wav' : 'mp3'}`;
    try {
      let binary = require('ffmpeg-static');
      if (app.isPackaged) binary = binary.replace('app.asar', 'app.asar.unpacked');
      const run = (command, args) => new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let errors = ''; child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-2000); });
        child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`处理失败：${errors.slice(-500)}`)));
      });
      let executable, model;
      if (options.mode === 'local') {
        const exe = await dialog.showOpenDialog(window, { title: '选择 whisper-cli 可执行文件', properties: ['openFile'] });
        if (exe.canceled || !exe.filePaths.length) return null;
        const selectedModel = await dialog.showOpenDialog(window, { title: '选择 whisper.cpp GGML 模型', properties: ['openFile'], filters: [{ name: '模型', extensions: ['bin'] }] });
        if (selectedModel.canceled || !selectedModel.filePaths.length) return null;
        executable = exe.filePaths[0]; model = selectedModel.filePaths[0];
      }
      await run(binary, ['-hide_banner','-loglevel','error','-y','-i',selectedFile,'-vn','-ac','1','-ar','16000', ...(options.mode === 'local' ? ['-c:a','pcm_s16le'] : ['-c:a','libmp3lame','-b:a','32k']),audio]);
      if (options.mode === 'local') {
        await run(executable, ['-m',model,'-f',audio,'-oj','-of',prefix]);
        const data = JSON.parse(await fs.readFile(`${prefix}.json`, 'utf8'));
        return segmentsToCues((data.transcription || []).map(s => ({start:s.offsets.from / 1000,end:s.offsets.to / 1000,text:s.text})));
      }
      const bytes = await fs.readFile(audio);
      if (bytes.length > 25 * 1000 * 1000) throw new Error('音频超过 OpenAI 单次上传限制，请先缩短视频。');
      const form = new FormData(); form.append('file', new Blob([bytes], {type:'audio/mpeg'}), 'audio.mp3'); form.append('model','whisper-1'); form.append('response_format','verbose_json');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method:'POST', headers:{Authorization:`Bearer ${options.key.trim()}`}, body:form, signal:AbortSignal.timeout(180000) });
      if (!response.ok) throw new Error(`OpenAI 识别失败（HTTP ${response.status}），请检查密钥、额度和网络。`);
      return segmentsToCues((await response.json()).segments);
    } finally {
      await Promise.all([fs.rm(audio,{force:true}),fs.rm(`${prefix}.json`,{force:true})]);
      exporting = false;
    }
  });
  ipcMain.handle('generate-dubbing', async (_event, options) => {
    if (!selectedFile || exporting) throw new Error('请先导入视频并等待当前任务完成');
    if (!options || !['local','openai'].includes(options.mode)) throw new Error('配音模式无效');
    formatSrt(options.cues);
    if (!Number.isFinite(options.duration) || options.duration <= 0 || options.duration > 86400 || options.cues.some(c => c.end > options.duration + 0.001)) throw new Error('字幕时间超出视频范围');
    if (options.cues.length > 100) throw new Error('单次最多生成 100 条配音');
    planDubbing(options.cues, options.cues.map(cue => cue.end - cue.start));
    if (options.mode === 'openai' && !['alloy','echo','fable','onyx','nova','shimmer'].includes(options.voice)) throw new Error('声音无效');
    if (options.mode === 'openai' && (typeof options.key !== 'string' || !options.key.trim())) throw new Error('请输入 OpenAI API 密钥');
    exporting = true;
    const prefix = `/private/tmp/frame-dub-${randomUUID()}`;
    const files = [];
    const original = `${prefix}-source.wav`, mixed = `${prefix}.wav`;
    let success = false;
    try {
      let binary = require('ffmpeg-static'); if (app.isPackaged) binary = binary.replace('app.asar','app.asar.unpacked');
      const run = (command,args,input) => new Promise((resolve,reject) => {
        const child=spawn(command,args,{stdio:['pipe','ignore','pipe']});let log='';
        child.stderr.on('data',x=>{log=(log+x).slice(-4000)});child.on('error',reject);child.stdin.on('error',()=>{});child.stdin.end(input);
        child.on('close',code=>code===0?resolve(log):reject(new Error(`处理失败：${log.slice(-500)}`)));
      });
      let executable, model;
      if (options.mode === 'local') {
        const exe=await dialog.showOpenDialog(window,{title:'选择 Piper 可执行文件',properties:['openFile']});if(exe.canceled||!exe.filePaths.length)return null;
        const voice=await dialog.showOpenDialog(window,{title:'选择 Piper 语音模型（需要同目录的 .json 配置）',properties:['openFile'],filters:[{name:'Piper 模型',extensions:['onnx']}]});if(voice.canceled||!voice.filePaths.length)return null;
        executable=exe.filePaths[0];model=voice.filePaths[0];
      }
      const durations=[];
      for (let i=0;i<options.cues.length;i++) {
        const file=`${prefix}-${i}.wav`;files.push(file);
        if (options.mode==='local') await run(executable,['--model',model,'--output_file',file],options.cues[i].text);
        else {
          const response=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${options.key.trim()}`,'Content-Type':'application/json'},body:JSON.stringify({model:'tts-1',voice:options.voice,input:options.cues[i].text,response_format:'wav'}),signal:AbortSignal.timeout(120000)});
          if(!response.ok)throw new Error(`第 ${i+1} 条配音失败（HTTP ${response.status}），请检查密钥、额度和网络。`);
          await fs.writeFile(file,Buffer.from(await response.arrayBuffer()),{mode:0o600});
        }
        const probe=spawn(binary,['-hide_banner','-i',file,'-f','null','-'],{stdio:['ignore','ignore','pipe']});let log='';probe.stderr.on('data',x=>{log=(log+x).slice(-6000)});
        await new Promise((resolve,reject)=>{probe.on('error',reject);probe.on('close',code=>code===0?resolve():reject(new Error(`第 ${i+1} 条音频无法读取`)))});
        const match=/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(log);if(!match)throw new Error(`无法读取第 ${i+1} 条配音时长`);
        durations.push(Number(match[1])*3600+Number(match[2])*60+Number(match[3]));
      }
      const plan=planDubbing(options.cues,durations);
      try { await run(binary,['-hide_banner','-loglevel','error','-y','-i',selectedFile,'-vn','-ac','2','-ar','44100','-c:a','pcm_s16le',original]); }
      catch (error) {
        if (!/does not contain any stream|matches no streams/i.test(error.message)) throw error;
        await run(binary,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','anullsrc=r=44100:cl=stereo','-t',String(options.duration),original]);
      }
      await run(binary,buildMixArgs(original,files,plan,mixed));
      if(dubbingFile)await fs.rm(dubbingFile,{force:true});
      dubbingFile=mixed;dubbingCues=JSON.stringify(options.cues);success=true;return true;
    } finally {
      await Promise.all([original,...files,...(success?[]:[mixed])].map(file=>fs.rm(file,{force:true})));
      exporting=false;
    }
  });
  ipcMain.handle('import-subtitles', async () => {
    const result = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: [{ name: 'SRT 字幕', extensions: ['srt'] }] });
    if (result.canceled || !result.filePaths.length) return null;
    const data = await fs.readFile(result.filePaths[0], 'utf8');
    return parseSrt(data);
  });
  ipcMain.handle('save-subtitles', async (_event, cues) => {
    const content = formatSrt(cues);
    const result = await dialog.showSaveDialog(window, { defaultPath: selectedFile ? `${path.parse(selectedFile).name}.srt` : 'subtitles.srt', filters: [{ name: 'SRT 字幕', extensions: ['srt'] }] });
    if (result.canceled || !result.filePath) return false;
    if (selectedFile && await isSourcePath(selectedFile, result.filePath)) throw new Error('输出文件不能覆盖源视频');
    const temporary = path.join(path.dirname(result.filePath), `.frame-${randomUUID()}.srt`);
    try { await fs.writeFile(temporary, content, { flag: 'wx' }); await fs.rename(temporary, result.filePath); }
    finally { await fs.rm(temporary, { force: true }); }
    return true;
  });
  ipcMain.handle('export-video', async (_event, options) => {
    if (!selectedFile) throw new Error('请先选择视频');
    if (exporting) throw new Error('已有导出任务正在进行');
    if (!Object.hasOwn(FORMATS, options.format)) throw new Error('格式不支持');
    exporting = true;
    try {
      const result = await dialog.showSaveDialog(window, { defaultPath: path.join(app.getPath('movies'), `${path.parse(selectedFile).name}-edited${FORMATS[options.format].ext}`), filters: [{ name: options.format.toUpperCase(), extensions: [options.format] }] });
      if (result.canceled || !result.filePath) return { canceled: true };
      if (await isSourcePath(selectedFile, result.filePath)) throw new Error('输出文件不能覆盖源视频');
      const temporary = path.join(path.dirname(result.filePath), `.frame-${randomUUID()}${FORMATS[options.format].ext}`);
      let binary = require('ffmpeg-static');
      if (app.isPackaged) binary = binary.replace('app.asar', 'app.asar.unpacked');
      let hasAudio = false;
      if (options.format !== 'gif') {
        hasAudio = await new Promise((resolve, reject) => {
          const child = spawn(binary, ['-hide_banner', '-v', 'error', '-i', selectedFile, '-map', '0:a:0', '-t', '0', '-f', 'null', '-'], { stdio: ['ignore','ignore','pipe'] });
          let errorText = '';
          child.stderr.on('data', data => { errorText = (errorText + data.toString()).slice(-4000); });
          child.on('error', reject);
          child.on('close', code => {
            if (code === 0) resolve(true);
            else if (errorText.includes('matches no streams')) resolve(false);
            else reject(new Error(`无法读取音频：${errorText.slice(-500)}`));
          });
        });
      }
      const subtitleFile = options.burnSubtitles ? `/private/tmp/frame-sub-${randomUUID()}.srt` : undefined;
      try {
      if (subtitleFile) await fs.writeFile(subtitleFile, formatSrt(options.cues), { flag: 'wx', mode: 0o600 });
      if (options.useDubbing && (!dubbingFile || JSON.stringify(options.cues) !== dubbingCues)) throw new Error('字幕已更改，请重新生成配音');
      const args = buildExportArgs({ ...options, input: selectedFile, output: temporary, hasAudio, subtitleFile, dubbingFile: options.useDubbing ? dubbingFile : undefined });
      await new Promise((resolve, reject) => {
        const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let errors = '';
        child.stderr.on('data', data => { errors = (errors + data.toString()).slice(-5000); });
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg 导出失败：${errors.slice(-1200)}`)));
      });
      await fs.rename(temporary, result.filePath);
      } finally { await fs.rm(temporary, { force: true }); if (subtitleFile) await fs.rm(subtitleFile, { force: true }); }
      return { path: result.filePath };
    } finally { exporting = false; }
  });
});
app.on('window-all-closed', () => { if (dubbingFile) require('node:fs').rmSync(dubbingFile, { force: true }); app.quit(); });
