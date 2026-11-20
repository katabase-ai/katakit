import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import type { GalleryOperation } from './operationDetails';
import type { GalleryAllowance } from './GalleryUsageProvider';
import type { GalleryAccount } from './GalleryAccountButton';

/** Only failures a host marks retryable are retried automatically; the rest need a click. */
export class GalleryModelError extends Error {
  constructor(
    message: string,
    public policy: {
      retryAfterMs?: number;
      retryLimit?: number;
      terminal?: boolean;
      restart?: boolean;
      clearable?: boolean;
      code?: string;
      resetsAt?: string;
    } = {}
  ) {
    super(message);
  }
}

/**
 * What a host's model service gives every demo with the `remoteModel` capability.
 * The host owns admission, transport, and its failure messages; each demo owns its prompt
 * and reads its own result out of the response.
 */
export type GalleryModelConnection = {
  model: string;
  maxBodyBytes: number;
  maxOutputTokens: number;
  /** Send a chat-completions request body and resolve with the parsed response body. */
  requestCompletion: (input: { body: string; signal: AbortSignal }) => Promise<unknown>;
  /** Hosts can correlate a demo's validation failure with their transport's request ID. */
  reportFailure?: (failure: Error & Pick<GalleryModelError, 'policy'>) => void;
};

/**
 * Admit one demo visit. `verification` is where a host may mount a browser check, and
 * `onAllowance` reports the requests left whenever the host learns a new count.
 */
export type GalleryModelConnect = (input: {
  signal: AbortSignal;
  verification: HTMLElement;
  onAllowance: (allowance: { remaining: number; total: number }) => void;
}) => Promise<GalleryModelConnection>;

/** `Gallery` selects either the host connection or the visitor-key transport. */
export const GalleryModelContext = createContext<{
  connect?: GalleryModelConnect;
  hostAvailable?: boolean;
  hostConnectionLabel?: string;
  isDeveloperView?: boolean;
  configure?: (operation?: GalleryOperation) => void;
  openSettings?: () => void;
  /** Why the active demo is limited; shown on the Settings button, which leads to the remedy. */
  settingsNotice?: string;
  allowance?: GalleryAllowance;
  usageUnavailableReason?: string;
  reportAllowance?: (allowance: GalleryAllowance) => void;
  account?: GalleryAccount;
}>({});

/**
 * One demo visit's use of the host's model connection. Its controls, the host's browser
 * check render inside the demo view; host allowance is shared with the footer.
 */
export const useGalleryModel = () => {
  const { connect, isDeveloperView, configure, reportAllowance, settingsNotice, openSettings } =
    useContext(GalleryModelContext);
  const verification = useRef<HTMLDivElement>(null);
  const connectVisit = useCallback(
    ({ signal }: { signal: AbortSignal }) =>
      connect!({
        signal,
        verification: verification.current!,
        onAllowance: value => {
          if (!signal.aborted) reportAllowance?.(value);
        },
      }),
    [connect, reportAllowance]
  );
  return {
    connect: connect && connectVisit,
    configure: isDeveloperView ? configure : undefined,
    settingsNotice: openSettings ? settingsNotice : undefined,
    renderControls: (controls: ReactNode) => (
      <>
        {controls}
        <div ref={verification} aria-label="Browser verification" />
      </>
    ),
  };
};
