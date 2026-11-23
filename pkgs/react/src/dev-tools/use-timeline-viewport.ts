import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
} from 'react';
import { clamp } from './time';

export const timelinePadding = 14;

/** Owns the scroll position, from native wheel/keyboard input through programmatic zoom and Fit. */
export const useTimelineViewport = (duration: number) => {
  const viewport = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const anchor = useRef<number | null>(null);
  const wheelTarget = useRef<number | null>(null);
  const drag = useRef<{ start: number; left: number } | null>(null);
  const [width, setWidth] = useState(500);
  const [offset, setOffset] = useState(0);
  const [scale, setScale] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const fit = (width - 2 * timelinePadding) / Math.max(100, duration);
  const px = scale ?? fit;
  const length = Math.max(width, Math.ceil(duration * px) + 2 * timelinePadding);

  useLayoutEffect(() => {
    const el = viewport.current!;
    const label = heading.current!;
    const resize = () => setWidth(Math.max(80, el.clientWidth - label.offsetWidth));
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    observer.observe(label);
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

  const zoom = useCallback(
    (factor: number, at = width / 2) => {
      const next = clamp(
        px * factor,
        Math.min(fit, 0.0001),
        Math.max(fit, Math.min(100, 8_000_000 / Math.max(1, duration)))
      );
      if (next === px) return;
      wheelTarget.current = null;
      const left = viewport.current!.scrollLeft;
      anchor.current = ((left + at - timelinePadding) * next) / px - at + timelinePadding;
      setFollow(false);
      setScale(next);
    },
    [width, px, fit, duration]
  );

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
      if (!e.deltaY) return;
      e.preventDefault();
      const unit =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? width
            : 1;
      const delta = e.deltaY * unit;
      const current = el.scrollLeft;
      const target = wheelTarget.current ?? current;
      // Accumulate wheel ticks, but reverse direction from the visible position.
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
  }, [width, zoom]);

  const handlers: HTMLAttributes<HTMLDivElement> = {
    onKeyDown() {
      wheelTarget.current = null;
    },
    onScroll(e) {
      const left = e.currentTarget.scrollLeft;
      setOffset(left);
      if (left + width < length - 2) setFollow(false);
    },
    onPointerDown(e) {
      wheelTarget.current = null;
      if (e.button || (e.target as Element).closest('[role=button]')) return;
      drag.current = { start: e.clientX, left: e.currentTarget.scrollLeft };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove(e) {
      if (drag.current)
        e.currentTarget.scrollLeft = drag.current.left + drag.current.start - e.clientX;
    },
    onLostPointerCapture() {
      drag.current = null;
    },
  };
  const fitRecording = () => {
    wheelTarget.current = null;
    anchor.current = null;
    setScale(null);
    setFollow(true);
  };
  return {
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
  };
};
