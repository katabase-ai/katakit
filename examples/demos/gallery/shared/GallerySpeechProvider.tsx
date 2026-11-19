import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createGallerySpeech } from './createGallerySpeech';
import { GalleryInferenceProvider } from './GalleryInferenceProvider';
import { GalleryNavigationFocusProvider } from './GalleryDemoHeader';
import { GalleryEventsContext, type GalleryEvent } from './galleryEvents';

type Session = {
  owner: ReturnType<typeof createGallerySpeech>;
  snapshot: ReturnType<ReturnType<typeof createGallerySpeech>['getSnapshot']>;
};
const GallerySpeechContext = createContext<Session | undefined>(undefined);

/**
 * Each mounted host gets an inert owner after hydration; no visitor state lives in a module.
 * A host that measures usage passes `onEvent`; see `GalleryEvent` for what it receives.
 */
export const GallerySpeechProvider = ({
  children,
  onEvent,
}: {
  children: ReactNode;
  onEvent?: (event: GalleryEvent) => void;
}) => {
  const [session, setSession] = useState<Session>();
  // The speech owner outlives renders, so it reads the host's current handler and demo here.
  const host = useRef<{ onEvent?: (event: GalleryEvent) => void; demoId?: string }>({});
  useEffect(() => {
    host.current.onEvent = onEvent;
  }, [onEvent]);
  const events = useMemo(
    () => ({
      report: (event: GalleryEvent) => {
        try {
          host.current.onEvent?.({ demoId: host.current.demoId, ...event });
        } catch {
          // A host's measurement must never interrupt capture or a demo.
        }
      },
      setActiveDemo: (demoId: string | undefined) => {
        host.current.demoId = demoId;
      },
    }),
    []
  );
  useEffect(() => {
    const owner = createGallerySpeech({
      onEvent: events.report,
      getDemoId: () => host.current.demoId,
    });
    const update = () => setSession({ owner, snapshot: owner.getSnapshot() });
    const unsubscribe = owner.subscribe(update);
    const hidden = () => {
      if (document.hidden) void owner.stop();
    };
    document.addEventListener('visibilitychange', hidden);
    update();
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      unsubscribe();
      void owner.dispose();
    };
  }, [events]);
  return (
    <GalleryNavigationFocusProvider>
      <GalleryEventsContext value={events}>
        <GalleryInferenceProvider>
          <GallerySpeechContext value={session}>{children}</GallerySpeechContext>
        </GalleryInferenceProvider>
      </GalleryEventsContext>
    </GalleryNavigationFocusProvider>
  );
};

export const useGallerySpeech = () => useContext(GallerySpeechContext);
