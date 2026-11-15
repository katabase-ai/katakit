import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@katakit/site-ui/styles.css';
import './style.css';

createRoot(document.getElementById('root')!).render(<App />);
