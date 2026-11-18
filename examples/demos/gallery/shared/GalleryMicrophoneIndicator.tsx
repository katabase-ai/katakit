import type { CSSProperties } from 'react';
import { Mic, MicOff } from 'lucide-react';

/** Passive capture status. The speech owner supplies live levels; this view owns no audio. */
export const GalleryMicrophoneIndicator = ({
  recording,
  level,
}: {
  recording: boolean;
  level: number;
}) => {
  const inputLevel = recording && Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  // Lift quieter speech visually without changing the transcriber's audio or level readings.
  const response = Math.sqrt(inputLevel);
  return (
    <div
      className="gallery-microphone-indicator"
      role="img"
      aria-label={recording ? 'Microphone listening' : 'Microphone off'}
      data-recording={recording}
      style={
        {
          '--gallery-microphone-level': inputLevel,
          '--gallery-microphone-response': response,
        } as CSSProperties
      }
    >
      {recording ? (
        <span className="gallery-microphone-glyph" aria-hidden="true">
          <Mic />
          <span className="gallery-microphone-glyph-level">
            <Mic />
          </span>
        </span>
      ) : (
        <MicOff aria-hidden="true" />
      )}
    </div>
  );
};
