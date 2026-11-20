import { createRoot } from 'react-dom/client';
import { App } from './App';
import { BrainstormRequestError, type BrainstormConnection } from './brainstormModel';
import './standalone.css';

const endpoint = import.meta.env.VITE_BRAINSTORM_ENDPOINT;
const model = import.meta.env.VITE_BRAINSTORM_MODEL;
const credential = import.meta.env.VITE_BRAINSTORM_CREDENTIAL;
const decisionEndpoint = import.meta.env.VITE_BRAINSTORM_DECISION_ENDPOINT;
const decisionModel = import.meta.env.VITE_BRAINSTORM_DECISION_MODEL;
const decisionCredential = import.meta.env.VITE_BRAINSTORM_DECISION_CREDENTIAL;
const connect =
  endpoint && model && decisionEndpoint && decisionModel
    ? async ({ signal }: { signal: AbortSignal }): Promise<BrainstormConnection> => {
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
            throw new BrainstormRequestError(
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
  <main className="brainstorm-standalone">
    <App connect={connect} />
  </main>
);
