import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type { ReactNode } from 'react';
import { tv, type VariantProps } from 'tailwind-variants/lite';

export const buttonClasses = tv({
  variants: {
    variant: {
      toolbar:
        ':uno: tool-button-chrome inline-flex h-8 px-2 text-zinc-300 hover:(bg-zinc-800 text-white) aria-pressed:(bg-teal-400/10 text-teal-300)',
      launcher:
        ':uno: tool-button-chrome ml-auto flex h-10 border border-zinc-700 bg-zinc-950 px-3 shadow-lg hover:bg-zinc-800',
      disclosure:
        ':uno: cursor-pointer rounded-sm text-left text-zinc-100 hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-300 [&[aria-expanded=true]>span]:rotate-90',
      marker: ':uno: cursor-pointer outline-none focus-visible:(stroke-white stroke-2)',
    },
  },
  defaultVariants: { variant: 'toolbar' },
});

const iconClasses = tv({
  variants: {
    icon: {
      launcher: ':uno: tool-button-icon i-lucide-audio-lines',
      collapse: ':uno: tool-button-icon i-lucide-chevron-down',
      lanes: ':uno: tool-button-icon i-lucide-list-filter',
      follow: ':uno: tool-button-icon i-lucide-scan-line',
      zoomOut: ':uno: tool-button-icon i-lucide-zoom-out',
      fit: ':uno: tool-button-icon i-lucide-scan',
      zoomIn: ':uno: tool-button-icon i-lucide-zoom-in',
      unpin: ':uno: tool-button-icon i-lucide-pin-off',
      expand: ':uno: tool-button-icon i-lucide-maximize-2',
      restore: ':uno: tool-button-icon i-lucide-minimize-2',
    },
  },
});

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
