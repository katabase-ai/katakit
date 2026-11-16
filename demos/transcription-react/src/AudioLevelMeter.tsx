import type { CSSProperties } from 'react';
import './audio-level-meter.css';

/** Host supplies microphone PCM activity; this display never requests audio permissions. */
export const AudioLevelMeter = ({
  active,
  level,
  label = 'Microphone',
}: {
  active: boolean;
  level: number;
  label?: string;
}) => (
  <div
    className="site-audio-level"
    role="img"
    aria-label={`${label}: ${active ? 'listening' : 'off'}`}
  >
    <span className="site-audio-level__label">{label}</span>
    <span className="site-audio-level__track" aria-hidden="true">
      <span
        className="site-audio-level__fill"
        style={
          {
            width: `${active ? Math.round(Math.max(0, Math.min(1, level)) * 100) : 0}%`,
          } as CSSProperties
        }
      />
    </span>
    <span className="site-audio-level__state">{active ? 'Listening' : 'Off'}</span>
  </div>
);
