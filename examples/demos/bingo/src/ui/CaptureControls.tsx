import { useId, type CSSProperties, type ReactNode } from 'react';
import type { TranscriptionState } from '@katakit/transcription';

export const MicrophoneIndicator = ({ active, level = 0 }: { active: boolean; level?: number }) => {
  const response = Math.sqrt(
    active && Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0
  );
  return (
    <span
      className="standalone-microphone"
      role="img"
      aria-label={active ? 'Microphone listening' : 'Microphone off'}
      data-recording={active}
      style={{ '--microphone-response': response } as CSSProperties}
    >
      {active ? (
        <span className="standalone-microphone-glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8" />
          </svg>
          <span className="standalone-microphone-level">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8" />
            </svg>
          </span>
        </span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M9 9v2a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.93-.65M5 10a7 7 0 0 0 12 4.9M19 10a7 7 0 0 1-.62 2.9M12 17v5m-4 0h8M2 2l20 20" />
        </svg>
      )}
    </span>
  );
};

/** Presentation only: the standalone host remains responsible for capture and cleanup. */
export const CaptureControls = ({
  input,
  active,
  level,
  busy,
  onToggle,
  startLabel = 'Start',
  stopLabel = 'Pause',
  children,
}: {
  input: TranscriptionState;
  active: boolean;
  level?: number;
  busy?: boolean;
  onToggle: () => void;
  startLabel?: string;
  stopLabel?: string;
  children?: ReactNode;
}) => {
  const statusId = useId();
  const settingUp = input.phase === 'loading' || input.phase === 'starting';
  const status =
    input.phase === 'loading'
      ? `Downloading speech model…${input.progress === undefined ? '' : ` ${Math.round(input.progress * 100)}%`}`
      : input.phase === 'starting'
        ? 'Allow microphone access in your browser.'
        : active
          ? 'Listening locally'
          : 'Microphone off';
  return (
    <>
      <div className="standalone-capture">
        <MicrophoneIndicator active={active} level={level} />
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          className="standalone-capture-button"
          aria-describedby={statusId}
          aria-label={
            active
              ? 'Pause listening'
              : settingUp
                ? undefined
                : startLabel === 'Start'
                  ? 'Start listening'
                  : startLabel
          }
        >
          {active ? stopLabel : settingUp ? 'Preparing…' : input.error ? 'Try again' : startLabel}
        </button>
        <span id={statusId} role="status">
          {status}
        </span>
      </div>
      {children}
      {input.error && (
        <p className="standalone-capture-error" role="alert">
          {input.error.message}
        </p>
      )}
    </>
  );
};
