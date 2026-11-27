import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import './controls.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'slate' | 'blue' | 'ghost' | 'border' | 'red';
  size?: 'regular' | 'icon';
};

/** Native button with locally styled variants. */
export const Button = ({
  variant = 'slate',
  size = 'regular',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    type={type}
    {...props}
    className={`site-button site-button--${variant} site-button--${size} ${className}`.trim()}
  />
);

export type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

/** Native select keeps keyboard and form semantics without a popup dependency. */
export const SelectField = ({
  label,
  hint,
  error,
  id,
  children,
  className = '',
  ...props
}: SelectFieldProps) => {
  return (
    <div className="site-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        {...props}
        className={`site-select ${className}`.trim()}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      >
        {children}
      </select>
      {hint && !error && (
        <span id={`${id}-hint`} className="site-field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="site-field-error">
          {error}
        </span>
      )}
    </div>
  );
};
