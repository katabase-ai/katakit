import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { GalleryDemoHeader, useGalleryDemoHeader } from './GalleryDemoHeader';

const Ready = createContext<(() => void) | undefined>(undefined);

/** Report a settled runtime lease before paint. Hosts without a frame keep their existing fallback. */
export const useGalleryDemoReady = (settled: boolean) => {
  const ready = useContext(Ready);
  useLayoutEffect(() => {
    if (settled) ready?.();
  }, [ready, settled]);
  return ready !== undefined;
};

/**
 * Keep one loading view through lazy imports, hydration, and the speech lease handoff.
 * Only the outgoing height is retained; its component and runtime are released normally.
 */
export const GalleryDemoFrame = (props: {
  demo: { id: string; title: string; description?: string };
  children: ReactNode;
}) => {
  const hasHeader = useGalleryDemoHeader();
  const body = <GalleryDemoBody {...props} />;
  return hasHeader ? body : <GalleryDemoHeader demo={props.demo}>{body}</GalleryDemoHeader>;
};

/** Delay only the feedback, never the content; each pending visit owns and clears its timer. */
const GalleryDemoActivity = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="gallery-demo-activity-slot">
      {visible && (
        <p className="gallery-demo-activity" role="status">
          <span className="gallery-demo-spinner" aria-hidden="true" />
          Opening…
        </p>
      )}
    </div>
  );
};

const GalleryDemoBody = ({
  demo,
  children,
}: {
  demo: { id: string; title: string };
  children: ReactNode;
}) => {
  const [state, setState] = useState({ id: demo.id, ready: false });
  // A destination visited again must acquire a new lease, even if an earlier visit was ready.
  if (state.id !== demo.id) setState({ id: demo.id, ready: false });
  const content = useRef<HTMLDivElement>(null);
  const previousHeight = useRef<number | undefined>(undefined);
  const pending = state.id !== demo.id || !state.ready;
  const ready = useCallback(
    () => setState(current => (current.id === demo.id ? { ...current, ready: true } : current)),
    [demo.id]
  );

  useLayoutEffect(() => {
    if (pending || !content.current) return;
    const node = content.current;
    const measure = () => {
      previousHeight.current = node.getBoundingClientRect().height;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [pending, demo.id]);

  return (
    <Ready value={ready}>
      <div
        className="gallery-demo-frame"
        data-loading={pending}
        style={
          pending && previousHeight.current ? { minHeight: previousHeight.current } : undefined
        }
      >
        {pending && <GalleryDemoActivity key={`activity-${demo.id}`} />}
        <div
          ref={content}
          className="gallery-demo-stage"
          aria-busy={pending}
          hidden={pending}
          key={demo.id}
        >
          <Suspense fallback={null}>{children}</Suspense>
        </div>
      </div>
    </Ready>
  );
};
