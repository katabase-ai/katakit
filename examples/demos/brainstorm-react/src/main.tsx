import { createRoot } from 'react-dom/client';
import { App } from './App';
import { BrainstormRequestError, type BrainstormConnection } from './brainstormModel';
import './standalone.css';

const endpoint = import.meta.env.VITE_BRAINSTORM_ENDPOINT;
const model = import.meta.env.VITE_BRAINSTORM_MODEL;
const credential = import.meta.env.VITE_BRAINSTORM_CREDENTIAL;
const connect =
  endpoint && model
    ? async ({ signal }: { signal: AbortSignal }): Promise<BrainstormConnection> => ({
        model,
        maxBodyBytes: 16384,
        maxOutputTokens: 2048,
        requestCompletion: async ({ body, signal: requestSignal }) => {
          const response = await fetch(endpoint, {
            method: 'POST',
            signal: AbortSignal.any([signal, requestSignal]),
            headers: {
              'Content-Type': 'application/json',
              ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
            },
            body,
          });
          if (!response.ok)
            throw new BrainstormRequestError(
              `Judging could not complete (${response.status}). Check the connection and try again.`
            );
          return await response.json();
        },
      })
    : undefined;

createRoot(document.getElementById('root')!).render(
  <main className="brainstorm-standalone">
    <App connect={connect} />
  </main>
);
