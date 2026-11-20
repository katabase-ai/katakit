import { useEffect, useRef, useState } from 'react';
import { BrainstormRequestError, type BrainstormConnection } from './brainstormModel';
import type { createBrainstormDemo } from './createBrainstormDemo';

/** Stop waiting immediately on cancellation, even if a host ignores its signal. */
const untilAborted = async <T>(work: Promise<T>, signal: AbortSignal): Promise<T> => {
  signal.throwIfAborted();
  let cancel!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    cancel = () => reject(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
  });
  try {
    return await Promise.race([work, aborted]);
  } finally {
    signal.removeEventListener('abort', cancel);
  }
};

/** A visit owns admission; each Start owns cancellable setup, never a running clock. */
export const useRoundSetup = ({
  runtime,
  connect,
  listening,
  startListening,
  isListening,
  stopListening,
}: {
  runtime: ReturnType<typeof createBrainstormDemo>;
  connect?: (input: { signal: AbortSignal }) => Promise<BrainstormConnection>;
  listening: boolean;
  startListening?: (signal: AbortSignal) => Promise<boolean>;
  isListening?: () => boolean;
  stopListening?: () => Promise<unknown>;
}) => {
  const [step, setStep] = useState<'microphone' | 'judge' | 'cancelling'>();
  const [error, setError] = useState<BrainstormRequestError>();
  const lifetime = useRef<AbortController>(undefined);
  const admission = useRef<AbortController>(undefined);
  const pending = useRef<AbortController>(undefined);

  useEffect(() => {
    const current = new AbortController();
    lifetime.current = current;
    setError(undefined);
    runtime.setConnectionMode(!connect);
    return () => {
      current.abort();
      lifetime.current = undefined;
      pending.current?.abort();
      admission.current?.abort();
      runtime.disconnect();
    };
  }, [runtime, connect]);

  const start = (typed: boolean, prepare: () => void) => {
    const visit = lifetime.current;
    if (
      !visit ||
      pending.current ||
      (runtime.state$.value.phase === 'finished' && runtime.state$.value.busy)
    )
      return;
    const controller = new AbortController();
    pending.current = controller;
    setError(undefined);
    prepare();
    let microphoneRequested = false;
    let preparingMicrophone = !typed;
    let began = false;
    void (async () => {
      try {
        if (!typed) {
          setStep('microphone');
          microphoneRequested = true;
          const ready = startListening
            ? await untilAborted(startListening(controller.signal), controller.signal)
            : listening;
          if (!ready)
            throw new BrainstormRequestError('The microphone could not start. Try again.');
        }
        controller.signal.throwIfAborted();
        preparingMicrophone = false;
        const state = runtime.state$.value;
        if (!state.practice && (!state.connected || state.failure?.policy.restart)) {
          if (!connect) throw new BrainstormRequestError('Answer judging is unavailable.');
          setStep('judge');
          admission.current?.abort();
          admission.current = new AbortController();
          const signal = AbortSignal.any([controller.signal, admission.current.signal]);
          const connection = await untilAborted(connect({ signal }), signal);
          signal.throwIfAborted();
          runtime.connect(connection);
        }
        controller.signal.throwIfAborted();
        if (visit.signal.aborted) return;
        if (!typed && !(isListening?.() ?? listening))
          throw new BrainstormRequestError('The microphone stopped during setup. Try again.');
        runtime.begin();
        began = runtime.state$.value.phase === 'running';
        if (!began)
          throw (
            runtime.state$.value.failure ?? new BrainstormRequestError('The round could not start.')
          );
      } catch (error_) {
        if (!controller.signal.aborted && !visit.signal.aborted)
          setError(
            error_ instanceof BrainstormRequestError
              ? error_
              : new BrainstormRequestError(
                  preparingMicrophone
                    ? 'The microphone could not start. Check its permissions and try again.'
                    : 'The judge could not connect. Start the round to try again.'
                )
          );
      } finally {
        if (!began) controller.abort();
        if (!began && microphoneRequested) {
          try {
            await stopListening?.();
          } catch {
            // The microphone host presents capture/cleanup failures.
          }
        }
        if (pending.current === controller) {
          pending.current = undefined;
          if (lifetime.current) setStep(undefined);
        }
      }
    })();
  };

  return {
    step,
    error,
    start,
    cancel: () => {
      setStep('cancelling');
      pending.current?.abort();
    },
  };
};
