import { createRoot } from 'react-dom/client';
import { App } from './App';
import { InferenceSetup } from './inference/InferenceSetup';
import { useLocalInference } from './inference/localInference';
import './style.css';

/** The dev server holds the model key; the setup panel sits with the notes controls. */
const StandaloneNotes = () => {
  const local = useLocalInference();
  return (
    <App
      connect={local.connect}
      connectionHelp={<InferenceSetup local={local} />}
      renderModelControls={controls => (
        <>
          {controls}
          {local.connect && <InferenceSetup local={local} />}
        </>
      )}
    />
  );
};

createRoot(document.getElementById('root')!).render(
  <main style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
    <StandaloneNotes />
  </main>
);
