import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';

const location = /(https?:\/\/[^\s()]+):(\d+):(\d+)(\)?)$/;
const internal =
  /(?:[/\\]rxjs[/\\]|[/\\](?:@katakit|pkgs)[/\\]react[/\\](?:src[/\\]dev-tools[./\\]|dist[/\\]index\.js)|\/\.vite\/deps\/(?:rxjs|@katakit_react)[._])/i;
export const isInternalFrame = (frame: string) =>
  internal.test(frame) ||
  /[/\\](?:node_modules|\.vite[/\\]deps|@vite|@react-refresh)[/\\?]/.test(frame) ||
  /(?:^|\s)(?:react_stack_bottom_frame|executeDispatch|dispatchDiscreteEvent)\b/.test(frame);

export const describeFrame = (frame: string) => {
  const match = frame.match(/^(?:at\s+)?(?:(.*?)\s+\(|(.*?)@)?(.*?):(\d+):(\d+)\)?$/);
  if (!match) return { name: frame.replace(/^at /, ''), file: '', path: frame };
  const path = match[3]!.split('?')[0]!;
  // Firefox names an anonymous function inside a named scope `scope/<`.
  const name = match[1] ?? match[2]?.replace(/(?:\/<)+$/, '');
  return {
    name: name && name !== '<' ? name : 'Anonymous function',
    file: `${path.split(/[/\\]/).at(-1)}:${match[4]}`,
    path: `${path}:${match[4]}:${match[5]}`,
  };
};
export const stackFrames = (stack: string) =>
  stack
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line !== 'Error');

// Resolve only inspected stacks. Cache generated-file lookups across dots; never
// fetch original source files. A missing map leaves the generated frame intact.
export const makeFrameResolver = (signal: AbortSignal) => {
  const maps = new Map<string, Promise<TraceMap | undefined>>();
  const load = async (file: string) => {
    if (new URL(file).origin !== window.location.origin) return;
    // Enforce the origin restriction on redirects as well as the initial URLs.
    const script = await fetch(file, { signal, mode: 'same-origin' });
    if (!script.ok) return;
    const ref =
      script.headers.get('SourceMap') ??
      (await script.text()).match(/\/\/[#@]\s*sourceMappingURL=(\S+)\s*$/m)?.[1];
    if (!ref) return;
    const scriptUrl = script.url || file;
    const url = new URL(ref, scriptUrl);
    const inline = url.protocol === 'data:';
    if (!inline && url.origin !== window.location.origin) return;
    const response = await fetch(url, { signal, mode: inline ? 'cors' : 'same-origin' });
    if (response.ok)
      return new TraceMap(await response.json(), inline ? scriptUrl : response.url || url.href);
  };
  return async (frame: string) => {
    const match = frame.match(location);
    if (!match) return frame;
    const [, file, line, column, suffix] = match;
    try {
      const map = maps.get(file!) ?? load(file!);
      maps.set(file!, map);
      const resolved = await map;
      if (!resolved) return frame;
      const pos = originalPositionFor(resolved, { line: Number(line), column: Number(column) - 1 });
      return pos.source
        ? frame.slice(0, match.index) + `${pos.source}:${pos.line}:${pos.column! + 1}${suffix}`
        : frame;
    } catch {
      return frame;
    }
  };
};
