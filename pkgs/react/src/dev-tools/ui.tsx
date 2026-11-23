import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type { ReactNode } from 'react';

// Local shadcn/Base UI button: fixed slots instead of merging consumer classes.
export const ToolButton = ({
  label,
  pressed,
  children,
  onClick,
  disabled,
}: {
  label: string;
  pressed?: boolean;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <ButtonPrimitive
    data-slot="button"
    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium text-xs cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-300 disabled:opacity-40 disabled:cursor-default h-8 px-2 text-zinc-300 hover:(bg-zinc-800 text-white) aria-pressed:(bg-teal-400/10 text-teal-300)"
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </ButtonPrimitive>
);
