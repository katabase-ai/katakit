import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export const galleryTermsNotice = {
  beforeLink: 'By continuing, you agree to our ',
  linkText: 'Terms of Service',
  afterLink: '.',
};

export type GalleryTermsAcceptance = {
  buttonLabel: string;
  termsUrl: string;
  noticeText: string;
};

const Context = createContext<
  { accepted: boolean; accept: (acceptance: GalleryTermsAcceptance) => void } | undefined
>(undefined);

/**
 * Mount once above the host's routes, including standalone embeds. Acceptance belongs to this
 * tab's session; sessionStorage restores it on reload and follows the browser's session lifetime.
 * Hosts can scope acceptance to a policy revision and record the noticed click through onAccept.
 * Recording is best-effort and never delays the action. Restoring a flag does not emit a click.
 */
export const GalleryConsentProvider = ({
  children,
  acceptanceKey,
  onAccept,
}: {
  children: ReactNode;
  acceptanceKey?: string;
  onAccept?: (acceptance: GalleryTermsAcceptance) => void | Promise<void>;
}) => {
  const storageKey = `katakit-demo-terms-accepted${acceptanceKey ? `:${acceptanceKey}` : ''}`;
  const [accepted, setAccepted] = useState(false);
  const acceptedRef = useRef(false);
  useEffect(() => {
    // Read after hydration so server rendering never depends on a visitor's browser storage.
    let restored = false;
    try {
      restored = window.sessionStorage.getItem(storageKey) === 'true';
    } catch {
      // Storage may be blocked; the mounted provider still remembers primary clicks.
    }
    acceptedRef.current = restored;
    setAccepted(restored);
  }, [storageKey]);
  const notifyHost = async (acceptance: GalleryTermsAcceptance) => {
    try {
      await onAccept?.(acceptance);
    } catch {
      // Delivery and retries belong to the host; neither sync nor async failure blocks capture.
    }
  };
  const accept = (acceptance: GalleryTermsAcceptance) => {
    if (acceptedRef.current) return;
    acceptedRef.current = true;
    setAccepted(true);
    try {
      window.sessionStorage.setItem(storageKey, 'true');
    } catch {
      // Continue the requested action even when session persistence is unavailable.
    }
    void notifyHost(acceptance);
  };
  return <Context value={{ accepted, accept }}>{children}</Context>;
};

export const useGalleryConsent = () => useContext(Context);
