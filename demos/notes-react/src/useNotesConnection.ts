import { useCallback, useEffect, useRef, useState } from 'react';
import type { createNotesDemo } from './createNotesDemo';
import { NotesRequestError, type NotesConnection } from './notesModel';

type AdmissionState =
  | { type: 'idle' | 'connecting' | 'connected'; error?: never }
  | { type: 'failed'; error: NotesRequestError };

/**
 * Admit once when listening starts. Only an explicit retry leaves a failed admission.
 * Keep the connection through capture stop/drain, and abort it when the visit ends.
 */
export const useNotesConnection = ({
  runtime,
  listening,
  connect,
}: {
  runtime: ReturnType<typeof createNotesDemo>;
  listening: boolean;
  connect?: (input: { signal: AbortSignal }) => Promise<NotesConnection>;
}) => {
  const [admission, setAdmission] = useState<AdmissionState>({ type: 'idle' });
  const owner = useRef<{ lifetime: AbortController; admission: AdmissionState }>(undefined);

  useEffect(() => {
    const lifetime = new AbortController();
    owner.current = { lifetime, admission: { type: 'idle' } };
    setAdmission(owner.current.admission);
    return () => {
      owner.current = undefined;
      lifetime.abort();
      // Capture drains after unmount; those final turns must not start another paid request.
      runtime.notes.close();
    };
  }, [runtime]);

  const connectModel = useCallback(async () => {
    const current = owner.current;
    if (!current || current.admission.type === 'connecting' || !connect) return;
    const update = (next: AdmissionState) => {
      if (owner.current !== current) return;
      // The ref also guards repeated clicks before React commits the next render.
      current.admission = next;
      setAdmission(next);
    };
    update({ type: 'connecting' });
    try {
      const connection = await connect({ signal: current.lifetime.signal });
      if (owner.current !== current) return;
      runtime.notes.connect(connection);
      update({ type: 'connected' });
    } catch (error) {
      update({
        type: 'failed',
        error:
          error instanceof NotesRequestError
            ? error
            : new NotesRequestError('Notes could not connect. Try again.'),
      });
    }
  }, [connect, runtime]);

  useEffect(() => {
    if (listening && owner.current?.admission.type === 'idle') void connectModel();
  }, [listening, connectModel]);

  return {
    connecting: admission.type === 'connecting',
    admissionError: admission.error,
    connectModel,
  };
};
