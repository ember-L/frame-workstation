(function () {
  function splitSegment(segments, point) {
    const index = segments.findIndex(({ start, end }) => point > start + 0.01 && point < end - 0.01);
    if (index < 0) return segments;
    const { start, end } = segments[index];
    return [...segments.slice(0, index), { start, end: point }, { start: point, end }, ...segments.slice(index + 1)];
  }
  function removeSegment(segments, index) {
    return segments.length > 1 && index >= 0 && index < segments.length ? segments.filter((_, i) => i !== index) : segments;
  }
  function timeAtPosition(x, left, width, duration) {
    return width > 0 ? Math.max(0, Math.min(1, (x - left) / width)) * duration : 0;
  }
  function timelineDuration(segments) { return segments.reduce((sum, clip) => sum + clip.end - clip.start, 0); }
  function toSourceTime(segments, point) {
    let remaining = Math.max(0, point);
    for (let i = 0; i < segments.length; i++) {
      const clip = segments[i], length = clip.end - clip.start;
      if (remaining < length || i === segments.length - 1) return clip.start + Math.min(remaining, length);
      remaining -= length;
    }
    return 0;
  }
  function toTimelineTime(segments, point) {
    let elapsed = 0;
    for (const clip of segments) {
      if (point < clip.start) return elapsed;
      if (point < clip.end) return elapsed + point - clip.start;
      elapsed += clip.end - clip.start;
    }
    return elapsed;
  }
  function nextSourceTime(segments, point) {
    for (const clip of segments) { if (point < clip.start) return clip.start; if (point < clip.end) return point; }
    return null;
  }
  const api = { splitSegment, removeSegment, timeAtPosition, timelineDuration, toSourceTime, toTimelineTime, nextSourceTime };
  if (typeof window !== 'undefined') Object.assign(window, api);
  if (typeof module !== 'undefined') module.exports = api;
}());
