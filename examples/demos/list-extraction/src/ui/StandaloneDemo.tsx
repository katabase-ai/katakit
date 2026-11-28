import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const CaptureSlot = createContext<HTMLElement | null>(null);

/** Game-controlled capture can appear under the page description without moving game ownership. */
export const StandaloneCapture = ({ children }: { children: ReactNode }) => {
  const target = useContext(CaptureSlot);
  return target ? createPortal(children, target) : null;
};

/** Page framing only. The copied app supplies its own input, connection and feature view. */
export const StandaloneDemo = ({
  title,
  description,
  controls,
  children,
}: {
  title: string;
  description: string;
  controls?: ReactNode;
  children: ReactNode;
}) => {
  const [capture, setCapture] = useState<HTMLElement | null>(null);
  return (
    <CaptureSlot value={capture}>
      <main className="standalone-demo">
        <header className="standalone-demo-header">
          <h1>{title}</h1>
          <p>{description}</p>
          <div ref={setCapture} className="standalone-demo-controls">
            {controls}
          </div>
        </header>
        {children}
      </main>
    </CaptureSlot>
  );
};
