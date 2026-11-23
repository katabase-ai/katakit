import type { Delivery } from './deliveries';
import { isInternalFrame, makeFrameResolver, stackFrames } from './frames';

const styles = `
  :host { position:fixed; z-index:2147483646; bottom:1rem; right:1rem; color:#eef2fa; font:14px/1.4 system-ui,sans-serif }
  details.panel { background:#18202d; border:1px solid #556376; border-radius:8px; padding:.6rem .85rem; box-shadow:0 4px 20px #0004 }
  .panel[open] { width:min(40rem,calc(100vw - 4rem)); height:min(24rem,65vh); overflow:auto }
  summary, button { cursor:pointer }
  summary { font-weight:600 }
  p { color:#b9c5d7; margin:.5rem 0 }
  .lane { display:grid; grid-template-columns: minmax(6rem,35%) 1fr; gap:.75rem; align-items:center; min-height:1.6rem }
  .name { overflow:hidden; white-space:nowrap; text-overflow:ellipsis }
  .track { position:relative; height:1.6rem; margin:0 .45rem; background:linear-gradient(#546177,#546177) center / 100% 1px no-repeat }
  .dot { position:absolute; top:50%; transform:translate(-50%,-50%); border:1px solid #18202d; border-radius:50%; width:.8rem; height:.8rem; padding:0; background:#81cfff }
  .dot:focus-visible, .dot:hover { z-index:1; outline:2px solid white }
  pre { white-space:pre-wrap; overflow-wrap:anywhere; font:12px/1.5 ui-monospace,monospace; margin:.4rem 0 }
`;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
};

const describeValue = (value: unknown, depth = 0): string => {
  if (value === null || typeof value !== 'object') return String(value).slice(0, 180);
  const array = Array.isArray(value);
  if (depth >= 2) return array ? `Array(${value.length})` : '{…}';
  const keys = Object.keys(value);
  const parts = keys.slice(0, 6).map(key => {
    const field = Object.getOwnPropertyDescriptor(value, key);
    const preview =
      field && 'value' in field ? describeValue(field.value, depth + 1) : '[accessor]';
    return array ? preview : `${key}: ${preview}`;
  });
  if (keys.length > parts.length) parts.push('…');
  return array ? `[${parts.join(', ')}]` : `{ ${parts.join(', ')} }`;
};

export const makePanel = () => {
  const host = element('aside');
  const root = host.attachShadow({ mode: 'open' });
  const panel = element('details');
  panel.className = 'panel';
  const status = element('p', 'Waiting for observable deliveries…');
  const lanes = element('div');
  const inspector = element('section');
  panel.append(element('summary', 'Katakit devtools'), status, lanes, inspector);
  root.append(element('style', styles), panel);
  document.body.append(host);

  const controller = new AbortController();
  const resolveFrame = makeFrameResolver(controller.signal);
  let selected: Delivery | undefined;
  const inspect = async (event: Delivery) => {
    if (selected === event) return;
    selected = event;
    const frames = stackFrames(event.stack);
    const visible = element('pre');
    const full = element('details');
    const all = element('pre');
    full.append(element('summary', 'Full stack'), all);
    const show = (lines: string[]) => {
      visible.textContent =
        lines.filter(line => !isInternalFrame(line)).join('\n') ||
        'No application frame available.';
      all.textContent = lines.join('\n') || 'Stack unavailable.';
    };
    show(frames);
    let preview: string;
    try {
      preview = describeValue(event.value);
    } catch {
      preview = '[value unavailable]';
    }
    inspector.replaceChildren(
      element(
        'strong',
        `${event.lane} · ${event.time.toFixed(2)} ms · subscription ${event.subscription}`
      ),
      element('pre', preview),
      element('b', 'Stack at delivery'),
      visible,
      full
    );
    const mapped = await Promise.all(frames.map(resolveFrame));
    if (selected === event) show(mapped);
  };

  const capacity = 500;
  const events: Delivery[] = [];
  const tracks = new Map<string, HTMLElement>();
  const dots = new Map<Delivery, HTMLButtonElement>();
  let total = 0;
  let frame: number | undefined;
  const draw = () => {
    frame = undefined;
    if (!panel.open || !events.length) return;
    const start = events[0]!.time;
    const end = events.at(-1)!.time;
    status.textContent = `${events.length} of ${total} deliveries · ${start.toFixed(1)}–${end.toFixed(1)} ms · hover or focus a dot`;
    const retained = new Set(events);
    for (const [event, dot] of dots) {
      if (retained.has(event)) continue;
      dot.remove();
      dots.delete(event);
      const track = tracks.get(event.lane)!;
      if (!track.childElementCount) {
        track.parentElement?.remove();
        tracks.delete(event.lane);
      }
    }
    for (const event of events) {
      let track = tracks.get(event.lane);
      if (!track) {
        track = element('div');
        track.className = 'track';
        tracks.set(event.lane, track);
        const row = element('div');
        row.className = 'lane';
        const label = element('span', event.lane);
        label.className = 'name';
        label.title = event.lane;
        row.append(label, track);
        lanes.append(row);
      }
      let dot = dots.get(event);
      if (!dot) {
        dot = element('button');
        dot.className = 'dot';
        dot.type = 'button';
        dot.setAttribute(
          'aria-label',
          `${event.lane}, ${event.time.toFixed(2)} ms, subscription ${event.subscription}`
        );
        dot.onpointerenter = dot.onfocus = dot.onclick = () => void inspect(event);
        track.append(dot);
        dots.set(event, dot);
      }
      dot.style.left = `${(100 * (event.time - start)) / (end - start || 1)}%`;
    }
  };
  const schedule = () => {
    if (panel.open && frame === undefined) frame = requestAnimationFrame(draw);
  };
  panel.ontoggle = schedule;
  return {
    record: (event: Delivery) => {
      if (events.length === capacity) events.shift();
      events.push(event);
      total++;
      schedule();
    },
    dispose: () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      controller.abort();
      events.length = 0;
      dots.clear();
      tracks.clear();
      selected = undefined;
      lanes.replaceChildren();
      host.remove();
    },
  };
};
