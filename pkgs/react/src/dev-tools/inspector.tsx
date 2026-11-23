import { useEffect, useState } from 'react';
import { describeFrame, isInternalFrame, makeFrameResolver, stackFrames } from './frames';
import type { Delivery } from './deliveries';
import { splitLane, stamp } from './time';
import { ToolButton } from './ui';
import { ValuePreview } from './value-preview';

export const Inspector = ({
  event,
  pinned,
  release,
  origin,
}: {
  event?: Delivery;
  pinned: boolean;
  release: () => void;
  origin: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [resolver, setResolver] = useState<ReturnType<typeof makeFrameResolver>>();
  useEffect(() => {
    const controller = new AbortController();
    setResolver(() => makeFrameResolver(controller.signal));
    return () => controller.abort();
  }, []);
  const [mapped, setMapped] = useState<{ event: Delivery; lines: string[] }>();
  useEffect(() => {
    if (!event || !resolver) return;
    let current = true;
    const load = async () => {
      const lines = await Promise.all(stackFrames(event.stack).map(resolver));
      if (current) setMapped({ event, lines });
    };
    void load();
    return () => {
      current = false;
    };
  }, [event, resolver]);
  if (!event)
    return (
      <div className="flex flex-1 min-h-32 items-center justify-center gap-3 border-t border-zinc-800 px-4 py-4 text-xs text-zinc-400">
        <span className="inline-block size-4 shrink-0 i-lucide-mouse-pointer-2" />
        Hover a delivery to inspect it. Click to pin its stack.
      </div>
    );
  const lines = mapped?.event === event ? mapped.lines : stackFrames(event.stack);
  const frames = lines.filter(line => !isInternalFrame(line)).map(describeFrame);
  return (
    <section
      className="flex flex-1 min-h-32 flex-col border-t border-zinc-700 bg-[#1b1c1f]"
      aria-label="Delivery inspector"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-block size-4 shrink-0 i-lucide-route" />
          <strong className="font-mono">{splitLane(event.lane).name}</strong>
          <span className="min-w-5 rounded bg-zinc-800 px-1 text-center font-mono text-[10px] text-zinc-300">
            {stamp(event.time - origin)}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-zinc-400">Message {event.messageNumber}</span>
          {pinned && (
            <ToolButton label="Unpin delivery" onClick={release}>
              <span className="inline-block size-4 shrink-0 i-lucide-pin-off" /> Unpin
            </ToolButton>
          )}
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-3 px-4 pb-3 sm:(gap-5 grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)])">
        <div
          className="flex min-w-0 flex-col data-[expanded-value]:(visible absolute inset-0 z-20 rounded-xl bg-[#1b1c1f] p-4)"
          data-expanded-value={expanded || undefined}
          onKeyDown={e => {
            if (expanded && e.key === 'Escape') {
              e.stopPropagation();
              setExpanded(false);
              e.currentTarget.querySelector('button')?.focus();
            }
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Value
            </h3>
            {expanded && (
              <span className="text-xs text-zinc-400">
                {splitLane(event.lane).name} · Message {event.messageNumber}
              </span>
            )}
            <ToolButton
              label={expanded ? 'Restore value' : 'Expand value'}
              pressed={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <span
                  aria-hidden="true"
                  className="inline-block size-4 shrink-0 i-lucide-minimize-2"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="inline-block size-4 shrink-0 i-lucide-maximize-2"
                />
              )}
            </ToolButton>
          </div>
          <ValuePreview key={`${event.lane}:${event.messageNumber}`} value={event.value} />
        </div>
        <div className="min-w-0 overflow-auto">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Stack at delivery
          </h3>
          <ol className="mt-1">
            {frames.map((f, i) => (
              <li
                key={`${i}:${f.path}`}
                className="flex min-w-0 items-baseline justify-between gap-3 border-b border-zinc-800 py-1 font-mono text-[11px]"
                title={f.path}
              >
                <span className="truncate text-zinc-200">{f.name}</span>
                <span className="shrink-0 text-zinc-400">{f.file}</span>
              </li>
            ))}
          </ol>
          {!frames.length && (
            <p className="text-xs text-zinc-400">No application frame at this delivery.</p>
          )}
          {lines.length > 0 && (
            <details key={event.time}>
              <summary className="mt-1 cursor-pointer text-[11px] text-zinc-400 hover:text-white">
                Full stack · {lines.length} frames
              </summary>
              <pre className="whitespace-pre-wrap break-all py-2 font-mono text-[10px] text-zinc-400">
                {lines.join('\n')}
              </pre>
            </details>
          )}
        </div>
      </div>
    </section>
  );
};
