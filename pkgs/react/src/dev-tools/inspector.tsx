import { useEffect, useState } from 'react';
import { describeFrame, isInternalFrame, makeFrameResolver, stackFrames } from './frames';
import type { Delivery } from './deliveries';
import { ui } from './theme.generated';
import { splitLane, stamp } from './time';
import { ToolButton } from './ui';

// Read bounded own data fields, never invoke getters or serialize a whole stream payload.
const preview = (value: unknown, depth = 0): unknown => {
  if (!value || typeof value !== 'object')
    return typeof value === 'string'
      ? value.slice(0, 160)
      : typeof value === 'bigint'
        ? String(value)
        : value;
  if (depth === 2) return Array.isArray(value) ? `Array(${value.length})` : '{…}';
  const entries = Object.keys(value)
    .slice(0, 6)
    .map(key => {
      const field = Object.getOwnPropertyDescriptor(value, key);
      return [
        key,
        field && 'value' in field ? preview(field.value, depth + 1) : '[accessor]',
      ] as const;
    });
  return Array.isArray(value) ? entries.map(([, v]) => v) : Object.fromEntries(entries);
};
const valueText = (value: unknown) => {
  try {
    return JSON.stringify(preview(value), null, 2) ?? String(value);
  } catch {
    return '[unavailable]';
  }
};

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
      <div className={ui.quiet}>
        <span className={ui.crosshair} />
        Hover a delivery to inspect it. Click to pin its stack.
      </div>
    );
  const lines = mapped?.event === event ? mapped.lines : stackFrames(event.stack);
  const frames = lines.filter(line => !isInternalFrame(line)).map(describeFrame);
  return (
    <section className={ui.inspection} aria-label="Delivery inspector">
      <header className={ui.detailTop}>
        <div className={ui.row}>
          <span className={ui.trace} />
          <strong>{splitLane(event.lane).name}</strong>
          <span className={ui.count}>{stamp(event.time - origin)}</span>
        </div>
        <div className={ui.row}>
          <span className={ui.hint}>Message {event.messageNumber}</span>
          {pinned && (
            <ToolButton label="Unpin delivery" onClick={release}>
              <span className={ui.pin} /> Unpin
            </ToolButton>
          )}
        </div>
      </header>
      <div className={ui.detailBody}>
        <div
          className={ui.valueColumn}
          data-expanded-value={expanded || undefined}
          onKeyDown={e => {
            if (expanded && e.key === 'Escape') {
              e.stopPropagation();
              setExpanded(false);
              e.currentTarget.querySelector('button')?.focus();
            }
          }}
        >
          <div className={ui.valueHeading}>
            <h3 className={ui.caption}>Value</h3>
            {expanded && (
              <span className={ui.hint}>
                {splitLane(event.lane).name} · Message {event.messageNumber}
              </span>
            )}
            <ToolButton
              label={expanded ? 'Restore value' : 'Expand value'}
              pressed={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              <span aria-hidden="true" className={expanded ? ui.restore : ui.expand} />
            </ToolButton>
          </div>
          <pre className={ui.payload} tabIndex={0}>
            {valueText(event.value)}
          </pre>
        </div>
        <div className={ui.stackColumn}>
          <h3 className={ui.caption}>Stack at delivery</h3>
          <ol className={ui.frameList}>
            {frames.map((f, i) => (
              <li key={`${i}:${f.path}`} className={ui.frame} title={f.path}>
                <span className={ui.frameName}>{f.name}</span>
                <span className={ui.file}>{f.file}</span>
              </li>
            ))}
          </ol>
          {!frames.length && <p className={ui.hint}>No application frame at this delivery.</p>}
          {lines.length > 0 && (
            <details key={event.time}>
              <summary className={ui.reveal}>Full stack · {lines.length} frames</summary>
              <pre className={ui.raw}>{lines.join('\n')}</pre>
            </details>
          )}
        </div>
      </div>
    </section>
  );
};
