export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const stamp = (ms: number) => `${(ms / 1000).toFixed(3)}s`;
export const palette = ['#5eead4', '#c4b5fd', '#93c5fd', '#fdba74', '#f9a8d4', '#bef264'];
export const splitLane = (lane: string) => {
  const dot = lane.lastIndexOf('.');
  return { group: lane.slice(0, dot), name: lane.slice(dot + 1) };
};

// Pick readable 1/2/5 intervals at every zoom level.
export const rulerTicks = (offset: number, width: number, scale: number) => {
  const target = 85 / scale;
  const base = 10 ** Math.floor(Math.log10(target));
  const step = ([1, 2, 5, 10].find(n => n * base >= target) ?? 10) * base;
  const first = Math.max(0, Math.floor(offset / scale / step));
  return Array.from(
    { length: Math.ceil(width / (step * scale)) + 2 },
    (_, i) => (first + i) * step
  );
};

export const cluster = <T>(events: readonly T[], x: (event: T) => number) => {
  const groups: { x: number; events: T[] }[] = [];
  for (const event of events) {
    const last = groups.at(-1);
    if (last && x(event) - last.x < 16) last.events.push(event);
    else groups.push({ x: x(event), events: [event] });
  }
  return groups;
};
