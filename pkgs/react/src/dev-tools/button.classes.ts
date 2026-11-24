export const buttonStyles = {
  toolbar:
    'tool-button-chrome inline-flex h-8 px-2 text-zinc-300 hover:(bg-zinc-800 text-white) aria-pressed:(bg-teal-400/10 text-teal-300)',
  launcher:
    'tool-button-chrome ml-auto flex h-10 border border-zinc-700 bg-zinc-950 px-3 shadow-lg hover:bg-zinc-800',
  disclosure:
    'cursor-pointer rounded-sm text-left text-zinc-100 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-300 [&[aria-expanded=true]>span]:rotate-90',
  marker: 'cursor-pointer outline-none focus-visible:(stroke-white stroke-2)',
};

export const iconStyles = {
  launcher: 'tool-button-icon i-lucide-audio-lines',
  collapse: 'tool-button-icon i-lucide-chevron-down',
  lanes: 'tool-button-icon i-lucide-list-filter',
  follow: 'tool-button-icon i-lucide-scan-line',
  zoomOut: 'tool-button-icon i-lucide-zoom-out',
  fit: 'tool-button-icon i-lucide-scan',
  zoomIn: 'tool-button-icon i-lucide-zoom-in',
  unpin: 'tool-button-icon i-lucide-pin-off',
  expand: 'tool-button-icon i-lucide-maximize-2',
  restore: 'tool-button-icon i-lucide-minimize-2',
};
