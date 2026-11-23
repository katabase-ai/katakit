import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Delivery } from './deliveries';
import { clamp, cluster, palette, rulerTicks, splitLane, stamp } from './time';
import { ui } from './theme.generated';
import { ToolButton } from './ui';

type Props = {
  events: readonly Delivery[];
  selected?: Delivery;
  onPreview: (event: Delivery) => void;
  onPin: (event: Delivery) => void;
};

export const Timeline = ({ events, selected, onPreview, onPin }: Props) => {
  const viewport = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [offset, setOffset] = useState(0);
  const [scale, setScale] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const [filter, setFilter] = useState(false);
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState(new Set<string>());
  const origin = useRef(events[0]?.time);
  useLayoutEffect(() => {
    origin.current ??= events[0]?.time;
  }, [events]);
  const zero = origin.current ?? events[0]?.time ?? 0;
  const last = (events.at(-1)?.time ?? zero) - zero;
  const pad = 14;
  const fit = (width - 2 * pad) / Math.max(100, last);
  const px = scale ?? fit;
  const length = Math.max(width, Math.ceil(last * px) + 2 * pad);
  const anchor = useRef<number | null>(null);
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
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoom(
        Math.exp(-clamp(e.deltaY, -300, 300) / 400),
        clamp(e.clientX - heading.current!.getBoundingClientRect().right, 0, width)
      );
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
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
  const toggle = (name: string) =>
    setHidden(previous => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const drag = useRef<{ start: number; left: number } | null>(null);
  return (
    <>
      <div className={ui.toolbar}>
        <div className={ui.group}>
          <ToolButton
            label="Choose observable lanes"
            pressed={filter}
            onClick={() => setFilter(!filter)}
          >
            <span className={ui.eye} /> Lanes <span className={ui.count}>{visible.length}</span>
          </ToolButton>
          <span className={ui.divider} />
          <ToolButton
            label="Follow latest delivery"
            pressed={follow}
            onClick={() => setFollow(!follow)}
          >
            <span className={ui.follow} /> Follow
          </ToolButton>
        </div>
        <div className={ui.group}>
          <ToolButton label="Zoom out" onClick={() => zoom(0.5)}>
            <span className={ui.minus} />
          </ToolButton>
          <ToolButton
            label="Fit recording"
            onClick={() => {
              anchor.current = 0;
              setScale(null);
              setFollow(true);
            }}
          >
            <span className={ui.fit} /> Fit
          </ToolButton>
          <ToolButton label="Zoom in" onClick={() => zoom(2)}>
            <span className={ui.plus} />
          </ToolButton>
        </div>
      </div>
      {filter && (
        <section aria-label="Lane visibility" className={ui.filters}>
          <input
            className={ui.search}
            aria-label="Search observables"
            placeholder="Find an observable…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className={ui.choices}>
            {names
              .filter(name => name.toLowerCase().includes(query.toLowerCase()))
              .map(name => (
                <label className={ui.choice} key={name}>
                  <input
                    type="checkbox"
                    className={ui.checkbox}
                    checked={!hidden.has(name)}
                    onChange={() => toggle(name)}
                  />
                  {name}
                </label>
              ))}
          </div>
        </section>
      )}
      <div
        className={ui.viewport}
        ref={viewport}
        aria-label="Scrollable delivery timeline"
        tabIndex={0}
        onScroll={e => {
          const left = e.currentTarget.scrollLeft;
          setOffset(left);
          if (left + width < length - 2) setFollow(false);
        }}
        onPointerDown={e => {
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
        <div className={ui.ruler}>
          <div ref={heading} className={ui.laneHead}>
            <span className={ui.caption}>Observables</span>
          </div>
          <svg className={ui.svg} width={length} height={30} aria-hidden="true">
            {ticks.map(t => (
              <g key={t}>
                <line className={ui.gridline} x1={pad + t * px} x2={pad + t * px} y1="21" y2="30" />
                <text className={ui.tick} x={pad + t * px} y="15">
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
            <div key={name} className={ui.strip}>
              <div className={ui.lane} title={name}>
                <svg width="7" height="7" aria-hidden="true">
                  <circle cx="3.5" cy="3.5" r="3.5" fill={color} />
                </svg>
                <div className={ui.laneText}>
                  <p className={ui.laneName}>{lane.name}</p>
                  <p className={ui.laneGroup}>{lane.group}</p>
                </div>
              </div>
              <svg className={ui.svg} width={length} height={43} aria-label={name}>
                {ticks.map(t => (
                  <line
                    key={t}
                    className={ui.gridline}
                    x1={pad + t * px}
                    x2={pad + t * px}
                    y1="0"
                    y2="43"
                  />
                ))}
                {selected && (
                  <line
                    className={ui.needle}
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
                    onPin(group.events[(group.events.indexOf(selected!) + 1) % n]!);
                  return (
                    <g
                      key={`${event.time}:${event.subscription}:${tracks.get(name)!.indexOf(event)}`}
                      role="button"
                      tabIndex={0}
                      className={ui.mark}
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
                            className={ui.markCount}
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
          <p className={ui.empty}>
            {names.length
              ? 'All lanes are hidden. Choose Lanes to restore them.'
              : 'Waiting for the first observable delivery…'}
          </p>
        )}
      </div>
    </>
  );
};
