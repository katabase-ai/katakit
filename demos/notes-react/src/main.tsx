import { createRoot } from 'react-dom/client';
import { App } from './App';
import { NotesRequestError } from './notesModel';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <main style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
    <App
      connect={async () => ({
        model: 'z-ai/glm-5.3',
        maxBodyBytes: 16_384,
        maxOutputTokens: 1024,
        requestNotes: async ({ body, signal }) => {
          const endpoint = import.meta.env.VITE_NOTES_ENDPOINT;
          const credential = import.meta.env.VITE_NOTES_CREDENTIAL;
          if (!endpoint || !credential)
            throw new NotesRequestError(
              'Configure a local model endpoint and credential as described in the README.'
            );
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
          const result = await response.json();
          return JSON.parse(result.choices[0].message.content);
        },
      })}
    />
  </main>
);
