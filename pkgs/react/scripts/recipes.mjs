const button = 'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium text-xs cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-300 disabled:opacity-40 disabled:cursor-default';
const icon = 'inline-block size-4 shrink-0';
export const recipes = {
  shell: 'fixed z-[2147483646] bottom-3 right-3 left-3 sm:(left-auto bottom-5 right-5) font-sans text-[13px] leading-normal text-zinc-100 antialiased',
  launch: `${button} ml-auto flex h-10 border border-zinc-700 bg-zinc-950 px-3 shadow-lg hover:bg-zinc-800`,
  panel: 'relative ml-auto w-full sm:w-[min(900px,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-zinc-700 bg-[#18191c] shadow-2xl',
  header: 'flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3',
  row: 'flex min-w-0 items-center gap-2',
  brand: 'grid size-8 shrink-0 place-items-center rounded-lg border border-teal-300/30 bg-teal-400/10 text-teal-300',
  title: 'text-sm font-semibold tracking-tight text-zinc-50',
  hint: 'text-xs text-zinc-400',
  tag: 'rounded-full border border-teal-400/25 bg-teal-400/10 px-2 py-0.5 font-mono text-[10px] text-teal-300',
  button: `${button} h-8 px-2 text-zinc-300 hover:(bg-zinc-800 text-white) aria-pressed:(bg-teal-400/10 text-teal-300)`,
  activity: `${icon} i-lucide-audio-lines`,
  collapse: `${icon} i-lucide-chevron-down`,
};
