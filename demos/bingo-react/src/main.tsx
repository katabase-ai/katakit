import { createRoot } from 'react-dom/client';
import './base.css';

const start = async () => {
  if (import.meta.env.DEV) {
    try {
      (await import('./developerTools')).installDeveloperCapture();
    } catch (error) {
      console.error('Developer capture unavailable', error);
    }
  }
  const { App } = await import('./App');
  createRoot(document.getElementById('root')!).render(<App />);
};
void start();
