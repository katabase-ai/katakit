import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
} from 'react';
import './galleryTooltip.css';

export type GalleryTooltipPosition = {
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
};
type TriggerProps = {
  'aria-describedby': string | undefined;
  onClick: MouseEventHandler<HTMLElement>;
};

/** Plain hover text for any trigger. Interactive popovers retain their own focus/dismissal rules. */
export const GalleryTooltip = ({
  description,
  side = 'top',
  align = 'start',
  className = '',
  dismissOnActivate = false,
  children,
}: GalleryTooltipPosition & {
  description: string;
  className?: string;
  dismissOnActivate?: boolean;
  children: (trigger: TriggerProps) => ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent | PointerEvent) => {
      if (event.type === 'keydown') {
        if ((event as KeyboardEvent).key !== 'Escape') return;
      } else if (root.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', dismiss);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', dismiss);
    };
  }, [open]);
  return (
    <span
      ref={root}
      className={`gallery-tooltip ${className}`.trim()}
      onPointerEnter={event => {
        if (event.pointerType !== 'touch') setOpen(true);
      }}
      onPointerLeave={event => {
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {children({
        'aria-describedby': open ? id : undefined,
        onClick: () => setOpen(!dismissOnActivate),
      })}
      <span
        id={id}
        role="tooltip"
        className="gallery-hover-panel gallery-tooltip-panel"
        data-side={side}
        data-align={align}
        hidden={!open}
      >
        {description}
      </span>
    </span>
  );
};

/** Button adapter shares the same tooltip behavior without taking over the button's action. */
export const GalleryTooltipButton = ({
  description,
  side,
  align,
  tooltipClassName,
  children,
  onClick,
  ...button
}: ButtonHTMLAttributes<HTMLButtonElement> &
  GalleryTooltipPosition & {
    description: string;
    tooltipClassName?: string;
  }) => (
  <GalleryTooltip
    description={description}
    side={side}
    align={align}
    className={tooltipClassName}
    dismissOnActivate={!!onClick}
  >
    {trigger => (
      <button
        {...button}
        type="button"
        aria-describedby={
          [button['aria-describedby'], trigger['aria-describedby']].filter(Boolean).join(' ') ||
          undefined
        }
        onClick={event => {
          trigger.onClick(event);
          onClick?.(event);
        }}
      >
        {children}
      </button>
    )}
  </GalleryTooltip>
);
