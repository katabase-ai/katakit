import { createRoot } from 'react-dom/client';
import { App } from './color-clash/ColorClashApp';
import './standalone.css';

createRoot(document.getElementById('root')!).render(<App />);
