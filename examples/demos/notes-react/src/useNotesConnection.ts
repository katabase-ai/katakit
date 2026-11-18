import { useCallback, useEffect, useRef, useState } from 'react';
import type { createNotesDemo } from './createNotesDemo';
import { NotesRequestError, type NotesConnection } from './notesModel';

type AdmissionState =
  | { type: 'idle' | 'connecting' | 'connected'; error?: never }
  | { type: 'failed'; error: NotesRequestError };

/** Capture and inference are independent. Only an explicit action starts remote work. */
export const useNotesConnection = ({
  runtime,
  connect,
}: {
  runtime: ReturnType<typeof createNotesDemo>;
  connect?: (input: { signal: AbortSignal }) => Promise<NotesConnection>;
}) => {
  const [admission, setAdmission] = useState<AdmissionState>({ type: 'idle' });
  const owner = useRef<{ lifetime: AbortController; admission: AdmissionState }>(undefined);

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

  const pause = useCallback(() => {
    if (!owner.current) return;
    owner.current.lifetime.abort();
    owner.current = { lifetime: new AbortController(), admission: { type: 'idle' } };
    runtime.notes.pause();
    setAdmission(owner.current.admission);
  }, [runtime]);

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
    try {
      const connection = await connect({ signal: current.lifetime.signal });
      if (owner.current !== current || current.lifetime.signal.aborted) return;
      runtime.notes.connect(connection);
      update({ type: 'connected' });
    } catch (error) {
      if (current.lifetime.signal.aborted) return;
      update({
        type: 'failed',
        error:
          error instanceof NotesRequestError
            ? error
            : new NotesRequestError('Notes could not connect. Try again.'),
      });
    }
  }, [connect, runtime]);

  return {
    connecting: admission.type === 'connecting',
    connected: admission.type === 'connected',
    admissionError: admission.error,
    connectModel,
    pause,
  };
};
