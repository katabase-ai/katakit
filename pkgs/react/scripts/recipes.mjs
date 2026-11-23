const button =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium text-xs cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-300 disabled:opacity-40 disabled:cursor-default';
const icon = 'inline-block size-4 shrink-0';
export const recipes = {
  shell:
    'fixed z-[2147483646] bottom-3 right-3 left-3 sm:(left-auto bottom-5 right-5) font-sans text-[13px] leading-normal text-zinc-100 antialiased',
  launch: `${button} ml-auto flex h-10 border border-zinc-700 bg-zinc-950 px-3 shadow-lg hover:bg-zinc-800`,
  panel:
    'relative ml-auto w-full max-h-[85dvh] sm:w-[min(900px,calc(100vw-2.5rem))] overflow-auto overscroll-contain rounded-xl border border-zinc-700 bg-[#18191c] shadow-2xl',
  header: 'flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3',
  row: 'flex min-w-0 items-center gap-2',
  brand:
    'grid size-8 shrink-0 place-items-center rounded-lg border border-teal-300/30 bg-teal-400/10 text-teal-300',
  title: 'text-lg font-semibold tracking-tight text-zinc-50',
  hint: 'text-xs text-zinc-400',
  tag: 'rounded-full border border-teal-400/25 bg-teal-400/10 px-2 py-0.5 font-mono text-[10px] text-teal-300',
  button: `${button} h-8 px-2 text-zinc-300 hover:(bg-zinc-800 text-white) aria-pressed:(bg-teal-400/10 text-teal-300)`,
  activity: `${icon} i-lucide-audio-lines`,
  collapse: `${icon} i-lucide-chevron-down`,
  eye: `${icon} i-lucide-list-filter`,
  plus: `${icon} i-lucide-zoom-in`,
  minus: `${icon} i-lucide-zoom-out`,
  fit: `${icon} i-lucide-scan`,
  follow: `${icon} i-lucide-scan-line`,
  layers: `${icon} i-lucide-layers-2`,
  toolbar:
    'flex flex-wrap items-center justify-between gap-1 border-b border-zinc-800 px-3 py-1.5 bg-zinc-900',
  group: 'flex items-center gap-0.5',
  divider: 'mx-1 h-4 border-l border-zinc-700',
  caption: 'font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400',
  count: 'min-w-5 rounded bg-zinc-800 px-1 text-center font-mono text-[10px] text-zinc-300',
  filters: 'border-b border-zinc-800 bg-[#202125] px-4 py-3',
  search:
    'w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-400',
  choices: 'mt-2 grid max-h-28 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2',
  choice:
    'flex items-center gap-2 rounded px-1 py-1 font-mono text-xs text-zinc-300 hover:bg-zinc-800',
  checkbox: 'size-3.5 accent-teal-400',
  viewport:
    'relative max-h-[min(32vh,280px)] min-h-24 overflow-auto overscroll-contain bg-[#131417]',
  strip: 'flex w-max items-stretch',
  ruler: 'sticky top-0 z-20 flex w-max items-stretch bg-[#1d1e22]',
  laneHead:
    'sticky left-0 z-10 flex w-[132px] shrink-0 items-center justify-between gap-2 border-r border-b border-zinc-800 bg-[#202125] px-3 sm:w-[208px]',
  lane: 'sticky left-0 z-10 flex w-[132px] shrink-0 items-center gap-2 border-r border-b border-zinc-800 bg-[#1b1c20] px-3 sm:w-[208px]',
  laneText: 'min-w-0 leading-tight',
  laneName: 'truncate font-mono text-xs font-medium text-zinc-100',
  laneGroup: 'mt-0.5 truncate text-[10px] text-zinc-400',
  svg: 'block shrink-0 border-b border-zinc-800',
  tick: 'fill-zinc-400 font-mono text-[10px]',
  gridline: 'stroke-zinc-800',
  needle: 'stroke-teal-300',
  mark: 'cursor-pointer outline-none focus-visible:(stroke-white stroke-2)',
  markCount: 'pointer-events-none fill-zinc-950 font-mono text-[9px] font-bold',
  empty: 'flex flex-col items-center gap-2 py-6 text-center text-xs text-zinc-400',
  footer:
    'flex items-center justify-between gap-2 border-t border-zinc-800 px-4 py-2 font-mono text-[10px] text-zinc-400',
  trace: `${icon} i-lucide-route`,
  crosshair: `${icon} i-lucide-mouse-pointer-2`,
  pin: `${icon} i-lucide-pin-off`,
  quiet:
    'flex h-44 items-center justify-center gap-3 border-t border-zinc-800 px-4 py-4 text-xs text-zinc-400',
  inspection: 'h-44 overflow-auto border-t border-zinc-700 bg-[#1b1c1f]',
  detailTop: 'flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2',
  detailBody:
    'grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 px-4 pb-3 sm:(gap-5 grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)])',
  payload:
    'mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-[#141518] px-3 py-2 font-mono text-[11px] leading-relaxed text-teal-200',
  frameList: 'mt-1 max-h-28 overflow-auto',
  frame:
    'flex min-w-0 items-baseline justify-between gap-3 border-b border-zinc-800 py-1 font-mono text-[11px]',
  frameName: 'truncate text-zinc-200',
  file: 'shrink-0 text-zinc-400',
  reveal: 'mt-1 cursor-pointer text-[11px] text-zinc-400 hover:text-white',
  raw: 'max-h-24 overflow-auto whitespace-pre-wrap break-all py-2 font-mono text-[10px] text-zinc-400',
};
