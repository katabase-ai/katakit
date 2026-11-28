import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ExtractionError, type ExtractionConnect } from './extractionModel';
import './standalone.css';

const endpoint = import.meta.env.VITE_EXTRACTION_ENDPOINT;
const credential = import.meta.env.VITE_EXTRACTION_CREDENTIAL;
// A local example transport. Public hosts supply admission and transport through connect.
const connect: ExtractionConnect | undefined =
  endpoint && credential
    ? async () => ({
        model: 'z-ai/glm-5.3',
        maxBodyBytes: 16384,
        maxOutputTokens: 2048,
        requestCompletion: async ({ body, signal }) => {
          const response = await fetch(endpoint, {
            method: 'POST',
            signal,
            credentials: 'omit',
            redirect: 'error',
            referrerPolicy: 'no-referrer',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}` },
            body,
          });
          if (!response.ok)
            throw new ExtractionError(
              'The model request failed. Check your endpoint and allowance.'
            );
          return response.json();
        },
      })
    : undefined;
createRoot(document.getElementById('root')!).render(<App connect={connect} />);
