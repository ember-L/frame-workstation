const { createReadStream } = require('node:fs');
const { stat } = require('node:fs/promises');
const { Readable } = require('node:stream');
const path = require('node:path');

async function mediaResponse(file, request) {
  const { size } = await stat(file);
  const types = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo' };
  const headers = { 'Accept-Ranges': 'bytes', 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' };
  const range = request.headers.get('range');
  let start = 0, end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]) || size === 0) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
    if (!match[1]) { const suffix = Number(match[2]); start = Math.max(0, size - suffix); }
    else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = String(size === 0 ? 0 : end - start + 1);
  const body = request.method === 'HEAD' || size === 0 ? null : Readable.toWeb(createReadStream(file, { start, end }));
  return new Response(body, { status: range ? 206 : 200, headers });
}
module.exports = { mediaResponse };
