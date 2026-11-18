import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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
export const GalleryDemoFrame = ({
  demo,
  children,
}: {
  demo: { id: string; title: string };
  children: ReactNode;
}) => {
  const [readyId, setReadyId] = useState<string>();
  const content = useRef<HTMLDivElement>(null);
  const previousHeight = useRef<number | undefined>(undefined);
  const pending = readyId !== demo.id;
  const ready = useCallback(() => setReadyId(demo.id), [demo.id]);

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
        aria-busy={pending}
        style={
          pending && previousHeight.current ? { minHeight: previousHeight.current } : undefined
        }
      >
        {pending && (
          <div className="gallery-demo-loading" data-demo={demo.id}>
            <h1>{demo.title}</h1>
            <p role="status">Loading demo…</p>
          </div>
        )}
        <div ref={content} className="gallery-demo-stage" hidden={pending} key={demo.id}>
          <Suspense fallback={null}>{children}</Suspense>
        </div>
      </div>
    </Ready>
  );
};
