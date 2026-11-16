import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createGallerySpeech } from './createGallerySpeech';

type Session = {
  owner: ReturnType<typeof createGallerySpeech>;
  snapshot: ReturnType<ReturnType<typeof createGallerySpeech>['getSnapshot']>;
};
const GallerySpeechContext = createContext<Session | undefined>(undefined);

/** Each mounted host gets an inert owner after hydration; no visitor state lives in a module. */
export const GallerySpeechProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session>();
  useEffect(() => {
    const owner = createGallerySpeech();
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
  }, []);
  return <GallerySpeechContext value={session}>{children}</GallerySpeechContext>;
};

export const useGallerySpeech = () => useContext(GallerySpeechContext);
