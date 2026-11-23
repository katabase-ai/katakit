import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type { ReactNode } from 'react';
import { ui } from './theme.generated';

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
    className={ui.button}
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </ButtonPrimitive>
);
