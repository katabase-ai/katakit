import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Resizable } from 'react-resizable';
import { ui } from './theme.generated';

type PanelSize = { width: number; height: number };
const minimum = { width: 360, height: 320 };

// Keep the library's injected class off the DOM. The SVG supplies intrinsic
// dimensions so the panel and its handles need neither inline styles nor extra classes.
const Frame = ({ children }: { children: ReactNode }) => (
  <div className={ui.frameBox}>{children}</div>
);

export const ResizablePanel = ({
  children,
  size,
  onResize,
}: {
  children: ReactNode;
  size: PanelSize;
  onResize: (size: PanelSize) => void;
}) => {
  const bounds = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(size);
  useLayoutEffect(() => {
    const el = bounds.current!;
    const measure = () => setAvailable({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const width = Math.min(available.width, size.width);
  const height = Math.min(available.height, size.height);
  return (
    <div className={ui.bounds} ref={bounds}>
      <Resizable
        width={width}
        height={height}
        resizeHandles={['n', 'w', 'nw']}
        minConstraints={[
          Math.min(minimum.width, available.width),
          Math.min(minimum.height, available.height),
        ]}
        maxConstraints={[available.width, available.height]}
        draggableOpts={{ enableUserSelectHack: false }}
        onResize={(_, data) => onResize(data.size)}
        handle={(edge, ref) => (
          <span
            ref={ref}
            data-resize-edge={edge}
            aria-hidden="true"
            title={edge === 'n' ? 'Resize height' : edge === 'w' ? 'Resize width' : 'Resize panel'}
            className={edge === 'n' ? ui.north : edge === 'w' ? ui.west : ui.corner}
          />
        )}
      >
        <Frame>
          <svg width={width} height={height} className={ui.sizer} aria-hidden="true" />
          <section className={ui.panel}>{children}</section>
        </Frame>
      </Resizable>
    </div>
  );
};
