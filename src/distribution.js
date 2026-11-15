const { spawnSync } = require('node:child_process');
function validateFfmpegBuild(version) {
  if (!version.includes('configuration:')) throw new Error('无法确认 FFmpeg 构建配置');
  if (/(?:^|\s)--enable-nonfree(?:\s|$)/m.test(version)) throw new Error('当前 FFmpeg 启用了 nonfree，不可再分发；请更换可分发的构建并核查许可证。');
}
if (require.main === module) {
  const result = spawnSync(require('ffmpeg-static'), ['-version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error('无法运行随包 FFmpeg');
  validateFfmpegBuild(result.stdout);
}
module.exports = { validateFfmpegBuild };
