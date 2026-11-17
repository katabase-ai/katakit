import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createGalleryInference, inferenceStorageKey } from './galleryInference';

type Session = {
  owner: ReturnType<typeof createGalleryInference>;
  settings: ReturnType<ReturnType<typeof createGalleryInference>['getSnapshot']>;
};
const Context = createContext<Session | undefined>(undefined);

/** Mounted once above the outlet, with the speech owner. Credentials never enter SSR. */
export const GalleryInferenceProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session>();
  useEffect(() => {
    // Access to localStorage itself may throw when browser storage is blocked.
    const storage = {
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
      removeItem: (key: string) => window.localStorage.removeItem(key),
    };
    const owner = createGalleryInference(storage);
    const update = () => setSession({ owner, settings: owner.getSnapshot() });
    const unsubscribe = owner.subscribe(update);
    const changed = (event: StorageEvent) => {
      if (event.key === inferenceStorageKey || event.key === null) owner.reload();
    };
    window.addEventListener('storage', changed);
    update();
    return () => {
      window.removeEventListener('storage', changed);
      unsubscribe();
      owner.dispose();
    };
  }, []);
  return <Context value={session}>{children}</Context>;
};
export const useGalleryInference = () => useContext(Context);
