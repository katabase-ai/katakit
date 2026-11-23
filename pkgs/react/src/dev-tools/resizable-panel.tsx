import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Resizable, type ResizeHandleAxis } from 'react-resizable';

type PanelSize = { width: number; height: number };
const minimum = { width: 360, height: 320 };

// Keep the library's injected class off the DOM. The SVG supplies intrinsic
// dimensions so the panel and its handles need neither inline styles nor extra classes.
const Frame = ({ children }: { children: ReactNode }) => (
  <div className="relative pointer-events-auto max-h-full max-w-full">{children}</div>
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
  const [activeEdge, setActiveEdge] = useState<ResizeHandleAxis>();
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
    <div
      className="fixed inset-3 sm:inset-5 pointer-events-none flex items-end justify-end data-[resizing]:[scrollbar-color:transparent_transparent]"
      ref={bounds}
      data-resizing={activeEdge ? true : undefined}
    >
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
        onResizeStart={(_, { handle }) => setActiveEdge(handle)}
        onResize={(_, data) => onResize(data.size)}
        onResizeStop={() => setActiveEdge(undefined)}
        handle={(edge, ref) => {
          const props = {
            ref,
            'data-resize-edge': edge,
            'data-resizing': edge === activeEdge || undefined,
            'aria-hidden': true,
          } as const;
          if (edge === 'n')
            return (
              <span
                {...props}
                title="Resize height"
                className="absolute z-30 touch-none select-none hover:bg-teal-300/30 data-[resizing]:bg-teal-300/30 inset-x-2 -top-1 h-2 cursor-ns-resize rounded"
              />
            );
          if (edge === 'w')
            return (
              <span
                {...props}
                title="Resize width"
                className="absolute z-30 touch-none select-none hover:bg-teal-300/30 data-[resizing]:bg-teal-300/30 inset-y-2 -left-1 w-2 cursor-ew-resize rounded"
              />
            );
          return (
            <span
              {...props}
              title="Resize panel"
              className="absolute z-30 touch-none select-none hover:bg-teal-300/30 data-[resizing]:bg-teal-300/30 -left-1 -top-1 size-4 cursor-nwse-resize rounded-tl-lg"
            />
          );
        }}
      >
        <Frame>
          <svg
            width={width}
            height={height}
            className="block invisible max-w-full max-h-full"
            aria-hidden="true"
          />
          <section className="absolute inset-0 flex flex-col overflow-auto overscroll-contain rounded-xl border border-zinc-700 bg-[#18191c] shadow-2xl has-[[data-expanded-value]]:(invisible overflow-clip)">
            {children}
          </section>
        </Frame>
      </Resizable>
      {activeEdge && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 pointer-events-auto select-none data-[edge=n]:cursor-ns-resize data-[edge=w]:cursor-ew-resize data-[edge=nw]:cursor-nwse-resize"
          data-edge={activeEdge}
        />
      )}
    </div>
  );
};
