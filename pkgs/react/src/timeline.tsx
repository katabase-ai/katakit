import { useMemo, useState } from 'react';
import { cluster, palette, rulerTicks, stamp } from './dev-tools/time';
import { timelinePadding as pad, useTimelineViewport } from './dev-tools/use-timeline-viewport';

/** A named track. IDs must be unique and stable across renders. */
export type TimelineLane = { id: string; label: string; color?: string };

/** A point in milliseconds on a caller-owned timeline. IDs must be unique and stable. */
export type TimelineEvent = { id: string; laneId: string; time: number };

/** Data and controlled selection for the standalone timeline. No capture or runtime is required. */
export type TimelineProps = {
  lanes: readonly TimelineLane[];
  events: readonly TimelineEvent[];
  /** Absolute time in milliseconds for the vertical playhead. */
  playheadTime?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** Optional event preview on pointer hover or keyboard focus. */
  onPreview?: (id: string) => void;
  /** Optional label for the empty timeline. */
  emptyLabel?: string;
};

/** Render caller-supplied events; import `@katakit/react/timeline.css` for styles. */
export const Timeline = ({
  lanes,
  events,
  playheadTime,
  selectedId,
  onSelect,
  onPreview,
  emptyLabel = 'No events yet.',
}: TimelineProps) => {
  const [filter, setFilter] = useState(false);
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  let zero = Infinity;
  let end = -Infinity;
  for (const event of events) {
    zero = Math.min(zero, event.time);
    end = Math.max(end, event.time);
  }
  if (!events.length) zero = 0;
  const last = events.length ? end - zero : 0;
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
  const x = (event: TimelineEvent) => pad + (event.time - zero) * px;
  const tracks = useMemo(() => {
    const grouped = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const lane = grouped.get(event.laneId);
      if (lane) lane.push(event);
      else grouped.set(event.laneId, [event]);
    }
    return lanes.map((lane, i) => ({
      ...lane,
      deliveries: (grouped.get(lane.id) ?? []).toSorted((a, b) => a.time - b.time),
      color: lane.color ?? palette[i % palette.length],
    }));
  }, [events, lanes]);
  const visible = tracks.filter(lane => !hidden.has(lane.id));
  const ticks = rulerTicks(offset, width, px);
  return (
    <div className="katakit-timeline">
      <div className="katakit-timeline-toolbar">
        <div>
          <button
            aria-label="Choose lanes"
            aria-pressed={filter}
            onClick={() => setFilter(!filter)}
          >
            Lanes {visible.length}
          </button>
          <button
            aria-label="Follow latest event"
            aria-pressed={follow}
            onClick={() => setFollow(!follow)}
          >
            Follow
          </button>
        </div>
        <div>
          <button aria-label="Zoom out" onClick={() => zoom(0.5)}>
            −
          </button>
          <button aria-label="Fit timeline" onClick={fitRecording}>
            Fit
          </button>
          <button aria-label="Zoom in" onClick={() => zoom(2)}>
            +
          </button>
        </div>
      </div>
      {filter && (
        <div className="katakit-timeline-picker" aria-label="Lane visibility">
          <input
            aria-label="Search lanes"
            placeholder="Find a lane…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {tracks
            .filter(lane => lane.label.toLowerCase().includes(query.trim().toLowerCase()))
            .map(lane => (
              <label key={lane.id}>
                <input
                  type="checkbox"
                  checked={!hidden.has(lane.id)}
                  onChange={() =>
                    setHidden(previous => {
                      const next = new Set(previous);
                      if (next.has(lane.id)) next.delete(lane.id);
                      else next.add(lane.id);
                      return next;
                    })
                  }
                />
                {lane.label}
              </label>
            ))}
        </div>
      )}
      <div
        className="katakit-timeline-viewport"
        ref={viewport}
        aria-label="Scrollable event timeline"
        tabIndex={0}
        {...handlers}
      >
        <div className="katakit-timeline-ruler">
          <div ref={heading} className="katakit-timeline-heading">
            <span>Lanes</span>
          </div>
          <svg className="katakit-timeline-plot" width={length} height={30} aria-hidden="true">
            {ticks.map(t => (
              <g key={t}>
                <line
                  className="katakit-timeline-grid"
                  x1={pad + t * px}
                  x2={pad + t * px}
                  y1="21"
                  y2="30"
                />
                <text className="katakit-timeline-tick" x={pad + t * px} y="15">
                  {t < 1000 ? `${+t.toFixed(1)}ms` : `${+(t / 1000).toFixed(2)}s`}
                </text>
              </g>
            ))}
          </svg>
        </div>
        {visible.map(({ id, label, deliveries, color }) => {
          return (
            <div key={id} className="katakit-timeline-row">
              <div className="katakit-timeline-heading katakit-timeline-lane" title={label}>
                <svg width="7" height="7" aria-hidden="true">
                  <circle cx="3.5" cy="3.5" r="3.5" fill={color} />
                </svg>
                <span>{label}</span>
              </div>
              <svg className="katakit-timeline-plot" width={length} height={43} aria-label={label}>
                {ticks.map(t => (
                  <line
                    key={t}
                    className="katakit-timeline-grid"
                    x1={pad + t * px}
                    x2={pad + t * px}
                    y1="0"
                    y2="43"
                  />
                ))}
                {playheadTime !== undefined && (
                  <line
                    className="katakit-timeline-playhead"
                    x1={pad + (playheadTime - zero) * px}
                    x2={pad + (playheadTime - zero) * px}
                    y1="0"
                    y2="43"
                    opacity=".55"
                  />
                )}
                {cluster(deliveries, x).map(group => {
                  const event = group.events[0]!;
                  const n = group.events.length;
                  const selectedIndex = group.events.findIndex(item => item.id === selectedId);
                  const choose = () => onSelect?.(group.events[(selectedIndex + 1) % n]!.id);
                  return (
                    <g
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      className="katakit-timeline-marker"
                      aria-label={`${label}, ${stamp(event.time - zero)}, ${n} ${n === 1 ? 'event' : 'events; click to cycle'}`}
                      aria-pressed={selectedIndex >= 0}
                      transform={`translate(${group.x},21)`}
                      onPointerEnter={() => onPreview?.(event.id)}
                      onFocus={() => onPreview?.(event.id)}
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
                            className="katakit-timeline-count"
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
          <p className="katakit-timeline-empty">
            {tracks.length ? 'All lanes are hidden. Choose Lanes to restore them.' : emptyLabel}
          </p>
        )}
      </div>
    </div>
  );
};
