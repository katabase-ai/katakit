import {
  createContext,
  useCallback,
  useContext,
  useId,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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
  settingsOpen?: boolean;
  setSettingsOpen?: (open: boolean) => void;
}>({});

/**
 * One demo visit's use of the host's model connection. Its controls, the host's browser
 * check, and usage meter render inside the demo view.
 */
export const useGalleryModel = () => {
  const { connect, setSettingsOpen } = useContext(GalleryModelContext);
  const configure = useCallback(() => setSettingsOpen?.(true), [setSettingsOpen]);
  const verification = useRef<HTMLDivElement>(null);
  const [allowance, setAllowance] = useState<{ remaining: number; total: number }>();
  const usageId = useId();
  useEffect(() => setAllowance(undefined), [connect]);
  const connectVisit = useCallback(
    ({ signal }: { signal: AbortSignal }) =>
      connect!({
        signal,
        verification: verification.current!,
        onAllowance: value => {
          if (!signal.aborted) setAllowance(value);
        },
      }),
    [connect]
  );
  return {
    connect: connect && connectVisit,
    configure,
    renderControls: (controls: ReactNode) => (
      <>
        {controls}
        <div ref={verification} aria-label="Browser verification" />
        {allowance && (
          <div className="gallery-model-allowance">
            <div className="gallery-model-allowance-label">
              <span id={usageId}>Usage</span>
              <span>
                {allowance.remaining} / {allowance.total} requests left
              </span>
            </div>
            <progress
              aria-labelledby={usageId}
              value={allowance.remaining}
              max={allowance.total}
              aria-valuetext={`${allowance.remaining} of ${allowance.total} requests left`}
            />
          </div>
        )}
      </>
    ),
  };
};
