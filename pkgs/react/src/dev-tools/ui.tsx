import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type { ReactNode } from 'react';
import { tv, type VariantProps } from 'tailwind-variants/lite';
import { buttonStyles, iconStyles } from './button.classes';

export const buttonClasses = tv({
  variants: { variant: buttonStyles },
  defaultVariants: { variant: 'toolbar' },
});

const iconClasses = tv({ variants: { icon: iconStyles } });

export const ToolButton = ({
  variant,
  icon,
  label,
  pressed,
  children,
  onClick,
  disabled,
}: {
  label: string;
  pressed?: boolean;
  variant?: Extract<VariantProps<typeof buttonClasses>['variant'], 'toolbar' | 'launcher'>;
  icon?: VariantProps<typeof iconClasses>['icon'];
  children?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <ButtonPrimitive
    data-slot="button"
    className={buttonClasses({ variant })}
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
  >
    {icon && <span aria-hidden="true" className={iconClasses({ icon })} />}
    {children}
  </ButtonPrimitive>
);
