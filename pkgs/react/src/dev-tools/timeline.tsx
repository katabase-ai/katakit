import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Delivery } from './deliveries';
import { clamp, cluster, palette, rulerTicks, splitLane, stamp } from './time';
import { ToolButton } from './ui';
import { LanePicker } from './lane-picker';

type Props = {
  events: readonly Delivery[];
  selected?: Delivery;
  pinned?: Delivery;
  hidden: ReadonlySet<string>;
  toggleLane: (name: string) => void;
  onPreview: (event: Delivery) => void;
  onPin: (event: Delivery) => void;
};

export const Timeline = ({
  events,
  selected,
  pinned,
  hidden,
  toggleLane,
  onPreview,
  onPin,
}: Props) => {
  const viewport = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [offset, setOffset] = useState(0);
  const [scale, setScale] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const [filter, setFilter] = useState(false);
  const zero = events[0]?.time ?? 0;
  const last = (events.at(-1)?.time ?? zero) - zero;
  const pad = 14;
  const fit = (width - 2 * pad) / Math.max(100, last);
  const px = scale ?? fit;
  const length = Math.max(width, Math.ceil(last * px) + 2 * pad);
  const anchor = useRef<number | null>(null);
  const wheelTarget = useRef<number | null>(null);
  const x = (event: Delivery) => pad + (event.time - zero) * px;
  useLayoutEffect(() => {
    const el = viewport.current!;
    const resize = () =>
      setWidth(Math.max(80, el.clientWidth - (heading.current?.offsetWidth ?? 0)));
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = viewport.current!;
    if (anchor.current !== null) {
      el.scrollLeft = anchor.current;
      anchor.current = null;
    } else if (follow) el.scrollLeft = length - width;
    setOffset(el.scrollLeft);
  }, [length, width, px, follow]);
  const zoom = (factor: number, at = width / 2) => {
    wheelTarget.current = null;
    const next = clamp(
      px * factor,
      Math.min(fit, 0.0001),
      Math.max(fit, Math.min(100, 8_000_000 / Math.max(1, last)))
    );
    anchor.current = ((offset + at - pad) * next) / px - at + pad;
    setFollow(false);
    setScale(next);
  };
  useEffect(() => {
    const el = viewport.current!;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoom(
          Math.exp(-clamp(e.deltaY, -300, 300) / 400),
          clamp(e.clientX - heading.current!.getBoundingClientRect().right, 0, width)
        );
        return;
      }
      // Leave horizontal trackpad gestures and Shift-wheel to the browser.
      if (e.shiftKey || e.deltaX || el.scrollWidth <= el.clientWidth) {
        wheelTarget.current = null;
        return;
      }
      const unit =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? width
            : 1;
      if (!e.deltaY) return;
      e.preventDefault();
      // Accumulate wheel ticks while the browser animates toward the destination.
      const delta = e.deltaY * unit;
      const current = el.scrollLeft;
      const target = wheelTarget.current ?? current;
      const start = (target - current) * delta < 0 ? current : target;
      wheelTarget.current = clamp(start + delta, 0, el.scrollWidth - el.clientWidth);
      el.scrollTo({
        left: wheelTarget.current,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    };
    const resetWheelTarget = () => {
      wheelTarget.current = null;
    };
    el.addEventListener('scrollend', resetWheelTarget);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('scrollend', resetWheelTarget);
      el.removeEventListener('wheel', wheel);
    };
  });
  const tracks = new Map<string, Delivery[]>();
  for (const e of events) {
    const lane = tracks.get(e.lane);
    if (lane) lane.push(e);
    else tracks.set(e.lane, [e]);
  }
  const names = [...tracks.keys()];
  const visible = names.filter(name => !hidden.has(name));
  const ticks = rulerTicks(offset, width, px);
  const drag = useRef<{ start: number; left: number } | null>(null);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-zinc-800 px-3 py-1.5 bg-zinc-900">
        <div className="flex items-center gap-0.5">
          <ToolButton
            label="Choose observable lanes"
            pressed={filter}
            onClick={() => setFilter(!filter)}
          >
            <span className="inline-block size-4 shrink-0 i-lucide-list-filter" /> Lanes{' '}
            <span className="min-w-5 rounded bg-zinc-800 px-1 text-center font-mono text-[10px] text-zinc-300">
              {visible.length}
            </span>
          </ToolButton>
          <span className="mx-1 h-4 border-l border-zinc-700" />
          <ToolButton
            label="Follow latest delivery"
            pressed={follow}
            onClick={() => setFollow(!follow)}
          >
            <span className="inline-block size-4 shrink-0 i-lucide-scan-line" /> Follow
          </ToolButton>
        </div>
        <div className="flex items-center gap-0.5">
          <ToolButton label="Zoom out" onClick={() => zoom(0.5)}>
            <span className="inline-block size-4 shrink-0 i-lucide-zoom-out" />
          </ToolButton>
          <ToolButton
            label="Fit recording"
            onClick={() => {
              anchor.current = 0;
              setScale(null);
              setFollow(true);
            }}
          >
            <span className="inline-block size-4 shrink-0 i-lucide-scan" /> Fit
          </ToolButton>
          <ToolButton label="Zoom in" onClick={() => zoom(2)}>
            <span className="inline-block size-4 shrink-0 i-lucide-zoom-in" />
          </ToolButton>
        </div>
      </div>
      {filter && <LanePicker lanes={names} hidden={hidden} toggle={toggleLane} />}
      <div
        className="relative flex-initial min-h-16 overflow-auto overscroll-contain bg-[#131417]"
        ref={viewport}
        aria-label="Scrollable delivery timeline"
        tabIndex={0}
        onKeyDown={() => {
          wheelTarget.current = null;
        }}
        onScroll={e => {
          const left = e.currentTarget.scrollLeft;
          setOffset(left);
          if (left + width < length - 2) setFollow(false);
        }}
        onPointerDown={e => {
          wheelTarget.current = null;
          if (e.button || (e.target as Element).closest('[role=button]')) return;
          drag.current = { start: e.clientX, left: e.currentTarget.scrollLeft };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          if (drag.current)
            e.currentTarget.scrollLeft = drag.current.left + drag.current.start - e.clientX;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <div className="sticky top-0 z-20 flex w-max items-stretch bg-[#1d1e22]">
          <div
            ref={heading}
            className="sticky left-0 z-10 flex w-[132px] shrink-0 items-center justify-between gap-2 border-r border-b border-zinc-800 bg-[#202125] px-3 sm:w-[208px]"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Observables
            </span>
          </div>
          <svg
            className="block shrink-0 border-b border-zinc-800"
            width={length}
            height={30}
            aria-hidden="true"
          >
            {ticks.map(t => (
              <g key={t}>
                <line
                  className="stroke-zinc-800"
                  x1={pad + t * px}
                  x2={pad + t * px}
                  y1="21"
                  y2="30"
                />
                <text className="fill-zinc-400 font-mono text-[10px]" x={pad + t * px} y="15">
                  {t < 1000 ? `${+t.toFixed(1)}ms` : `${+(t / 1000).toFixed(2)}s`}
                </text>
              </g>
            ))}
          </svg>
        </div>
        {visible.map(name => {
          const color = palette[names.indexOf(name) % palette.length];
          const lane = splitLane(name);
          return (
            <div key={name} className="flex w-max items-stretch">
              <div
                className="sticky left-0 z-10 flex w-[132px] shrink-0 items-center gap-2 border-r border-b border-zinc-800 bg-[#1b1c20] px-3 sm:w-[208px]"
                title={name}
              >
                <svg width="7" height="7" aria-hidden="true">
                  <circle cx="3.5" cy="3.5" r="3.5" fill={color} />
                </svg>
                <div className="min-w-0 leading-tight">
                  <p className="truncate font-mono text-xs font-medium text-zinc-100">
                    {lane.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-zinc-400">{lane.group}</p>
                </div>
              </div>
              <svg
                className="block shrink-0 border-b border-zinc-800"
                width={length}
                height={43}
                aria-label={name}
              >
                {ticks.map(t => (
                  <line
                    key={t}
                    className="stroke-zinc-800"
                    x1={pad + t * px}
                    x2={pad + t * px}
                    y1="0"
                    y2="43"
                  />
                ))}
                {selected && (
                  <line
                    className="stroke-teal-300"
                    x1={x(selected)}
                    x2={x(selected)}
                    y1="0"
                    y2="43"
                    opacity=".55"
                  />
                )}
                {cluster(tracks.get(name)!, x).map(group => {
                  const event = group.events[0]!;
                  const n = group.events.length;
                  const choose = () =>
                    onPin(group.events[(group.events.indexOf(pinned!) + 1) % n]!);
                  return (
                    <g
                      key={event.messageNumber}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer outline-none focus-visible:(stroke-white stroke-2)"
                      aria-label={`${lane.name}, ${stamp(event.time - zero)}, ${n} ${n === 1 ? 'delivery' : 'deliveries; click to cycle'}`}
                      transform={`translate(${group.x},21)`}
                      onPointerEnter={() => onPreview(event)}
                      onFocus={() => onPreview(event)}
                      onClick={choose}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          choose();
                        }
                      }}
                    >
                      <rect x="-8" y="-16" width="22" height="32" fill="transparent" />
                      {n === 1 ? (
                        <path d="M0 -6 6 0 0 6 -6 0Z" fill={color} />
                      ) : (
                        <>
                          <rect
                            x="-7"
                            y="-8"
                            width={n > 9 ? 22 : 17}
                            height="16"
                            rx="4"
                            fill={color}
                          />
                          <text
                            className="pointer-events-none fill-zinc-950 font-mono text-[9px] font-bold"
                            x={n > 9 ? 4 : 1.5}
                            y="3"
                            textAnchor="middle"
                          >
                            {n}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })}
        {!visible.length && (
          <p className="flex flex-col items-center gap-2 py-6 text-center text-xs text-zinc-400">
            {names.length
              ? 'All lanes are hidden. Choose Lanes to restore them.'
              : 'Waiting for the first observable delivery…'}
          </p>
        )}
      </div>
    </>
  );
};
