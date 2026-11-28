import { createRoot } from 'react-dom/client';
import type { ComponentProps } from 'react';
import { App } from './App';
import { NotesRequestError } from './notesModel';
import './style.css';
import './standalone.css';

const endpoint = import.meta.env.VITE_NOTES_ENDPOINT;
const credential = import.meta.env.VITE_NOTES_CREDENTIAL;
const connect: ComponentProps<typeof App>['connect'] =
  endpoint && credential
    ? async () => ({
        model: 'z-ai/glm-5.3',
        maxBodyBytes: 16_384,
        maxOutputTokens: 1024,
        requestCompletion: async ({ body, signal }) => {
          const response = await fetch(endpoint, {
            method: 'POST',
            signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` },
            body,
          });
          if (!response.ok)
            throw new NotesRequestError(
              'The model request failed. Check your endpoint and allowance.'
            );
          return await response.json();
        },
      })
    : undefined;

createRoot(document.getElementById('root')!).render(<App connect={connect} />);
