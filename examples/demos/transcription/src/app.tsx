import { createRoot } from 'react-dom/client';
import { Transcription } from './transcription/transcription';
import './standalone.css';
import './transcription/style.css';

createRoot(document.getElementById('root')!).render(<Transcription />);
