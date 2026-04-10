const HOT_VIDEO = `${import.meta.env.BASE_URL}hot-icon.mp4`;
const WARM_VIDEO = `${import.meta.env.BASE_URL}warm-icon.mp4`;
const IDLE_VIDEO = `${import.meta.env.BASE_URL}idle-icon.mp4`;

export function levelClass(n) {
  if (n >= 10) return 'hot';
  if (n >= 3) return 'warm';
  return 'idle';
}

export function levelLabel(n) {
  if (n >= 10) return 'Hot';
  if (n >= 3) return 'Warm';
  return 'Idle';
}

export { HOT_VIDEO, WARM_VIDEO, IDLE_VIDEO };