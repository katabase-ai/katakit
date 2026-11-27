import { createRoot } from 'react-dom/client';
import { Transcription } from './transcription/transcription';
import './base.css';
import './transcription/style.css';

createRoot(document.getElementById('root')!).render(
  <main className="shell">
    <Transcription />
  </main>
);
