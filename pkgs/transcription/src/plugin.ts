import { makeKatakitPlugin, property } from '@katakit/core';
import { BehaviorSubject } from 'rxjs';

/** IDs identify one finalized source line, so retransmission cannot duplicate a turn. */
export type TranscriptSegment = {
  id: string;
  sourceId: string;
  text: string;
  speaker?: string;
  startMs?: number;
  endMs?: number;
};

export type TranscriptTurn = {
  id: string;
  sourceId: string;
  text: string;
  speaker?: string;
  startMs?: number;
  endMs?: number;
};

export type TranscriptionState = {
  turns: TranscriptTurn[];
  /** Finalized words in the turn currently being assembled. */
  current?: TranscriptTurn;
  /** Mutable recognition text; never part of a finalized turn. */
  provisional?: string;
};

export const makeTranscriptionPlugin = ({
  turnSilenceMs = 1400,
}: { turnSilenceMs?: number } = {}) => {
  if (!Number.isFinite(turnSilenceMs) || turnSilenceMs < 0) {
    throw new Error('turnSilenceMs must be a nonnegative number');
  }

  return makeKatakitPlugin({
    type: 'Transcription',
    configure: (options: {}) => options,
    observables: () => ({
      state$: property(new BehaviorSubject<TranscriptionState>({ turns: [] })),
    }),
    methods: ({ observables }) => {
      const { state$ } = observables;
      const seen = new Set<string>();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let closed = false;

      const update = (patch: Partial<TranscriptionState>) => {
        state$.next({ ...state$.get(), ...patch });
      };
      const flush = () => {
        if (timer) clearTimeout(timer);
        timer = undefined;
        const { current, turns } = state$.get();
        if (current)
          update({ turns: [...turns, current], current: undefined, provisional: undefined });
        else if (state$.get().provisional) update({ provisional: undefined });
      };
      const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, turnSilenceMs);
      };

      return {
        updateProvisional: (text: string) => {
          if (!closed) update({ provisional: text.trim() || undefined });
        },
        ingestSegment: (segment: TranscriptSegment) => {
          if (closed) return;
          const key = `${segment.sourceId}\0${segment.id}`;
          if (seen.has(key)) return;
          const text = segment.text.trim();
          if (!text) return;
          seen.add(key);

          const current = state$.get().current;
          if (
            current &&
            (current.sourceId !== segment.sourceId ||
              current.speaker !== segment.speaker ||
              (segment.startMs !== undefined &&
                current.endMs !== undefined &&
                segment.startMs - current.endMs > turnSilenceMs))
          ) {
            flush();
          }
          const active = state$.get().current;
          update({
            provisional: undefined,
            current: active
              ? {
                  ...active,
                  text: `${active.text} ${text}`,
                  endMs: segment.endMs ?? active.endMs,
                }
              : {
                  id: key,
                  sourceId: segment.sourceId,
                  speaker: segment.speaker,
                  text,
                  startMs: segment.startMs,
                  endMs: segment.endMs,
                },
          });
          schedule();
        },
        flush,
        /** Host must stop its audio source separately before closing the plugin. */
        close: () => {
          flush();
          closed = true;
        },
      };
    },
  });
};
