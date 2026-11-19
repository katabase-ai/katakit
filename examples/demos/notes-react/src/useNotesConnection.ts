import { useCallback, useEffect, useRef, useState } from 'react';
import { delay } from 'es-toolkit';
import type { createNotesDemo } from './createNotesDemo';
import { NotesRequestError, type NotesConnection } from './notesModel';

type AdmissionState =
  | { type: 'idle' | 'connecting' | 'connected'; error?: never }
  | { type: 'failed'; error: NotesRequestError };

/** A failed admission or an expired session is tried again on its own this many times. */
const RETRY_LIMIT = 2;
const RETRY_AFTER_MS = 300;

/**
 * Remote work follows capture: notes connect while the host is listening, never before. Failures
 * are retried automatically a bounded number of times; starting to listen again retries once more.
 */
export const useNotesConnection = ({
  runtime,
  connect,
  listening = false,
}: {
  runtime: ReturnType<typeof createNotesDemo>;
  connect?: (input: { signal: AbortSignal }) => Promise<NotesConnection>;
  /** Whether the host is capturing speech. */
  listening?: boolean;
}) => {
  const [admission, setAdmission] = useState<AdmissionState>({ type: 'idle' });
  const owner = useRef<{ lifetime: AbortController; admission: AdmissionState }>(undefined);
  // Reconnections after a session the host asked to restart, counted per listening start.
  const restarts = useRef(0);

  useEffect(() => {
    owner.current = { lifetime: new AbortController(), admission: { type: 'idle' } };
    setAdmission(owner.current.admission);
    return () => {
      owner.current?.lifetime.abort();
      owner.current = undefined;
      runtime.notes.pause();
    };
  }, [runtime, connect]);

  // The capture owner closes the runtime after draining. Effect cleanup only pauses remote work,
  // so Strict Mode can replay setup without permanently closing this live runtime.

  const connectModel = useCallback(async () => {
    if (!owner.current || owner.current.admission.type === 'connecting' || !connect) return;
    owner.current.lifetime.abort();
    runtime.notes.pause();
    const current = {
      lifetime: new AbortController(),
      admission: { type: 'connecting' } as AdmissionState,
    };
    owner.current = current;
    const update = (next: AdmissionState) => {
      if (owner.current !== current) return;
      current.admission = next;
      setAdmission(next);
    };
    update({ type: 'connecting' });
    for (let attempt = 0; ; attempt++) {
      try {
        const connection = await connect({ signal: current.lifetime.signal });
        if (owner.current !== current || current.lifetime.signal.aborted) return;
        runtime.notes.connect(connection);
        update({ type: 'connected' });
        return;
      } catch (error) {
        if (current.lifetime.signal.aborted) return;
        const failure =
          error instanceof NotesRequestError
            ? error
            : new NotesRequestError('Notes could not connect.');
        if (failure.policy.terminal || attempt >= RETRY_LIMIT) {
          update({ type: 'failed', error: failure });
          return;
        }
        try {
          await delay(RETRY_AFTER_MS, { signal: current.lifetime.signal });
        } catch {
          // The delay rejects when this admission is replaced or the visit ends.
          return;
        }
      }
    }
  }, [connect, runtime]);

  // Declared after the reset above, so a changed connection reconnects while listening continues.
  // Each listening start is also one more attempt at whatever had failed.
  useEffect(() => {
    if (!listening) return;
    restarts.current = 0;
    const current = owner.current?.admission;
    if (current?.type === 'idle' || (current?.type === 'failed' && !current.error.policy.terminal))
      void connectModel();
    else if (current?.type === 'connected') runtime.notes.retry();
  }, [listening, connectModel, runtime]);

  // A session the host asks to restart needs a new admission, not another request on the old one.
  useEffect(() => {
    const subscription = runtime.state$.subscribe(({ notes }) => {
      if (
        notes.status === 'paused' &&
        notes.failure?.policy.restart &&
        !notes.failure.policy.terminal &&
        owner.current?.admission.type === 'connected' &&
        restarts.current < RETRY_LIMIT
      ) {
        restarts.current++;
        void connectModel();
      }
    });
    return () => subscription.unsubscribe();
  }, [runtime, connectModel]);

  return {
    connecting: admission.type === 'connecting',
    admissionError: admission.error,
  };
};
