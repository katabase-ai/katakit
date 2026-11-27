import { createRoot } from 'react-dom/client';
import { App } from './App';
import { WordRushRequestError, type WordRushConnection } from './wordRushModel';
import './standalone.css';

const endpoint = import.meta.env.VITE_WORD_RUSH_ENDPOINT;
const model = import.meta.env.VITE_WORD_RUSH_MODEL;
const credential = import.meta.env.VITE_WORD_RUSH_CREDENTIAL;
const decisionEndpoint = import.meta.env.VITE_WORD_RUSH_DECISION_ENDPOINT;
const decisionModel = import.meta.env.VITE_WORD_RUSH_DECISION_MODEL;
const decisionCredential = import.meta.env.VITE_WORD_RUSH_DECISION_CREDENTIAL;
const connect =
  endpoint && model && decisionEndpoint && decisionModel
    ? async ({ signal }: { signal: AbortSignal }): Promise<WordRushConnection> => {
        const request = async (
          url: string,
          token: string | undefined,
          { body, signal: requestSignal }: { body: string; signal: AbortSignal }
        ) => {
          const lifetime = AbortSignal.any([signal, requestSignal]);
          lifetime.throwIfAborted();
          const response = await fetch(url, {
            method: 'POST',
            signal: lifetime,
            credentials: 'omit',
            redirect: 'error',
            referrerPolicy: 'no-referrer',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body,
          });
          if (!response.ok)
            throw new WordRushRequestError(
              `Judging could not complete (${response.status}). Check the connection and try again.`
            );
          const result: unknown = await response.json();
          lifetime.throwIfAborted();
          return result;
        };
        return {
          model,
          maxBodyBytes: 16384,
          maxOutputTokens: 2048,
          requestCompletion: input => request(endpoint, credential, input),
          decisions: {
            model: decisionModel,
            maxQuestions: 16,
            requestDecision: input => request(decisionEndpoint, decisionCredential, input),
          },
        };
      }
    : undefined;

createRoot(document.getElementById('root')!).render(
  <main className="word-rush-standalone">
    <App connect={connect} />
  </main>
);
