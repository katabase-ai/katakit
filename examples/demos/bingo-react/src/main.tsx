import { createRoot } from 'react-dom/client';
import './base.css';
import { App } from './App';

const start = async () => {
  if (import.meta.env.DEV) {
    const { openKatakitDevtools } = await import('@katakit/react/dev-tools');
    const close = openKatakitDevtools();
    import.meta.hot?.dispose(close);
  }
  createRoot(document.getElementById('root')!).render(<App />);
};
void start();
