import { useMemo, useState } from 'react';
import type { Delivery } from './deliveries';
import { cluster, palette, rulerTicks, splitLane, stamp } from './time';
import { timelinePadding as pad, useTimelineViewport } from './use-timeline-viewport';
import { buttonClasses, ToolButton } from './ui';
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
  const [filter, setFilter] = useState(false);
  const zero = events[0]?.time ?? 0;
  const last = (events.at(-1)?.time ?? zero) - zero;
  const {
    viewport,
    heading,
    handlers,
    width,
    offset,
    px,
    length,
    follow,
    setFollow,
    zoom,
    fitRecording,
  } = useTimelineViewport(last);
  const x = (event: Delivery) => pad + (event.time - zero) * px;
  const lanes = useMemo(() => {
    const tracks = new Map<string, Delivery[]>();
    for (const event of events) {
      const lane = tracks.get(event.lane);
      if (lane) lane.push(event);
      else tracks.set(event.lane, [event]);
    }
    return [...tracks].map(([name, deliveries], i) => ({
      name,
      deliveries,
      color: palette[i % palette.length],
    }));
  }, [events]);
  const visible = lanes.filter(lane => !hidden.has(lane.name));
  const ticks = rulerTicks(offset, width, px);
  return (
    <>
      <div className=":uno: flex flex-wrap items-center justify-between gap-1 border-b border-zinc-800 px-3 py-1.5 bg-zinc-900">
        <div className=":uno: flex items-center gap-0.5">
          <ToolButton
            label="Choose observable lanes"
            icon="lanes"
            pressed={filter}
            onClick={() => setFilter(!filter)}
          >
            Lanes
            <span className=":uno: min-w-5 rounded bg-zinc-800 px-1 text-center font-mono text-[10px] text-zinc-300">
              {visible.length}
            </span>
          </ToolButton>
          <span className=":uno: mx-1 h-4 border-l border-zinc-700" />
          <ToolButton
            label="Follow latest delivery"
            icon="follow"
            pressed={follow}
            onClick={() => setFollow(!follow)}
          >
            Follow
          </ToolButton>
        </div>
        <div className=":uno: flex items-center gap-0.5">
          <ToolButton label="Zoom out" icon="zoomOut" onClick={() => zoom(0.5)} />
          <ToolButton label="Fit recording" icon="fit" onClick={fitRecording}>
            Fit
          </ToolButton>
          <ToolButton label="Zoom in" icon="zoomIn" onClick={() => zoom(2)} />
        </div>
      </div>
      {filter && (
        <LanePicker lanes={lanes.map(lane => lane.name)} hidden={hidden} toggle={toggleLane} />
      )}
      <div
        className=":uno: relative flex-initial min-h-16 overflow-auto overscroll-contain bg-[#131417]"
        ref={viewport}
        aria-label="Scrollable delivery timeline"
        tabIndex={0}
        {...handlers}
      >
        <div className=":uno: sticky top-0 z-20 flex w-max items-stretch bg-[#1d1e22]">
          <div
            ref={heading}
            className=":uno: sticky left-0 z-10 flex w-[132px] shrink-0 items-center justify-between gap-2 border-r border-b border-zinc-800 bg-[#202125] px-3 sm:w-[208px]"
          >
            <span className=":uno: text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Observables
            </span>
          </div>
          <svg
            className=":uno: block shrink-0 border-b border-zinc-800"
            width={length}
            height={30}
            aria-hidden="true"
          >
            {ticks.map(t => (
              <g key={t}>
                <line
                  className=":uno: stroke-zinc-800"
                  x1={pad + t * px}
                  x2={pad + t * px}
                  y1="21"
                  y2="30"
                />
                <text className=":uno: fill-zinc-400 font-mono text-[10px]" x={pad + t * px} y="15">
                  {t < 1000 ? `${+t.toFixed(1)}ms` : `${+(t / 1000).toFixed(2)}s`}
                </text>
              </g>
            ))}
          </svg>
        </div>
        {visible.map(({ name, deliveries, color }) => {
          const lane = splitLane(name);
          return (
            <div key={name} className=":uno: flex w-max items-stretch">
              <div
                className=":uno: sticky left-0 z-10 flex w-[132px] shrink-0 items-center gap-2 border-r border-b border-zinc-800 bg-[#1b1c20] px-3 sm:w-[208px]"
                title={name}
              >
                <svg width="7" height="7" aria-hidden="true">
                  <circle cx="3.5" cy="3.5" r="3.5" fill={color} />
                </svg>
                <div className=":uno: min-w-0 leading-tight">
                  <p className=":uno: truncate font-mono text-xs font-medium text-zinc-100">
                    {lane.name}
                  </p>
                  <p className=":uno: mt-0.5 truncate text-[10px] text-zinc-400">{lane.group}</p>
                </div>
              </div>
              <svg
                className=":uno: block shrink-0 border-b border-zinc-800"
                width={length}
                height={43}
                aria-label={name}
              >
                {ticks.map(t => (
                  <line
                    key={t}
                    className=":uno: stroke-zinc-800"
                    x1={pad + t * px}
                    x2={pad + t * px}
                    y1="0"
                    y2="43"
                  />
                ))}
                {selected && (
                  <line
                    className=":uno: stroke-teal-300"
                    x1={x(selected)}
                    x2={x(selected)}
                    y1="0"
                    y2="43"
                    opacity=".55"
                  />
                )}
                {cluster(deliveries, x).map(group => {
                  const event = group.events[0]!;
                  const n = group.events.length;
                  const choose = () =>
                    onPin(group.events[pinned ? (group.events.indexOf(pinned) + 1) % n : 0]!);
                  return (
                    <g
                      key={event.messageNumber}
                      role="button"
                      tabIndex={0}
                      className={buttonClasses({ variant: 'marker' })}
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
                            className=":uno: pointer-events-none fill-zinc-950 font-mono text-[9px] font-bold"
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
          <p className=":uno: flex flex-col items-center gap-2 py-6 text-center text-xs text-zinc-400">
            {lanes.length
              ? 'All lanes are hidden. Choose Lanes to restore them.'
              : 'Waiting for the first observable delivery…'}
          </p>
        )}
      </div>
    </>
  );
};
