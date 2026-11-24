import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const storageKey = 'katakit-demo-terms-accepted';
const Context = createContext<{ accepted: boolean; accept: () => void } | undefined>(undefined);

/**
 * Mount once above the host's routes, including standalone embeds. Acceptance belongs to this
 * tab's session; sessionStorage restores it on reload and follows the browser's session lifetime.
 */
export const GalleryConsentProvider = ({ children }: { children: ReactNode }) => {
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    // Read after hydration so server rendering never depends on a visitor's browser storage.
    try {
      setAccepted(window.sessionStorage.getItem(storageKey) === 'true');
    } catch {
      // Storage may be blocked; the mounted provider still remembers primary clicks.
    }
  }, []);
  const accept = () => {
    setAccepted(true);
    try {
      window.sessionStorage.setItem(storageKey, 'true');
    } catch {
      // Continue the requested action even when session persistence is unavailable.
    }
  };
  return <Context value={{ accepted, accept }}>{children}</Context>;
};

export const useGalleryConsent = () => useContext(Context);
