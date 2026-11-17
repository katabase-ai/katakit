import { useEffect, useState } from 'react';
import { createMicrophoneTranscriber } from '@katakit/transcription/browser';
import type { TranscriptionState } from '@katakit/transcription';
import { ColorClash } from './ColorClash';
import { createColorClash } from './createColorClash';

/** The standalone example owns its microphone and game without any gallery or host dependency. */
export const App = () => {
  const [session, setSession] = useState<{
    runtime: ReturnType<typeof createColorClash>;
    play: () => Promise<boolean>;
    stop: () => void;
    cancel: () => void;
  }>();
  const [state, setState] = useState<TranscriptionState>({ phase: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const runtime = createColorClash();
    let mounted = true;
    let phase: TranscriptionState['phase'] = 'idle';
    let cancelling = false;
    const createInput = () =>
      createMicrophoneTranscriber({
        model: 'moonshine-tiny',
        onState: next => {
          phase = next.phase;
          if (mounted && !cancelling) setState(next);
        },
        onFinal: runtime.ingestSegment,
        onProvisional: runtime.updateProvisional,
        onStop: runtime.flush,
      });
    let input = createInput();
    const stop = async () => {
      try {
        await input.stop();
      } catch {
        /* Recognition failures are already reported by onState. */
      }
    };
    const cancel = async () => {
      if (cancelling) return;
      cancelling = true;
      setBusy(true);
      try {
        // Disposal aborts pending microphone permission before waiting for recognition to drain.
        await input.dispose();
        if (mounted) {
          input = createInput();
          phase = 'idle';
          setState({ phase: 'idle' });
          setBusy(false);
        }
      } catch (error_) {
        if (mounted)
          setError(
            `${error_ instanceof Error ? error_.message : String(error_)} Reload to try again.`
          );
      } finally {
        cancelling = false;
      }
    };
    setSession({
      runtime,
      play: async () => {
        try {
          await input.start();
          return mounted && phase === 'running';
        } catch {
          return false;
        }
      },
      stop: () => void stop(),
      cancel: () => void cancel(),
    });
    const hidden = () => {
      if (!document.hidden) return;
      if (phase === 'loading' || phase === 'starting') void cancel();
      else void stop();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', hidden);
      void (async () => {
        try {
          try {
            if (phase === 'running' || phase === 'stopping') await input.stop();
          } finally {
            try {
              await input.dispose();
            } finally {
              runtime.close();
            }
          }
        } catch (error_) {
          reportError(error_);
        }
      })();
    };
  }, []);
  return (
    <main>
      {session ? (
        <ColorClash
          runtime={session.runtime}
          input={state}
          error={error}
          disabled={busy || state.phase === 'stopping'}
          onPlay={session.play}
          onCancel={session.cancel}
          onStop={session.stop}
        />
      ) : (
        <p role="status">Preparing Color Clash…</p>
      )}
    </main>
  );
};
