import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  value: string | number;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { value, onChange, size = 'md', mono = false, style, className = '', ...rest },
  ref,
) {
  const height   = size === 'sm' ? 24 : 28;
  const fontSize = size === 'sm' ? 11 : 12;

  return (
    <input
      ref={ref}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className={`xcb-input${className ? ` ${className}` : ''}`}
      style={{
        height,
        padding: '0 7px',
        fontSize,
        fontFamily: mono ? 'monospace' : undefined,
        background: 'var(--input-bg)',
        border: '1px solid var(--input-border)',
        borderTopColor: 'var(--input-border-top)',
        boxShadow: 'inset 0 2px 4px var(--shadow-8), inset 0 1px 2px var(--shadow-6), 0 1px 0 var(--shine-2)',
        borderRadius: 4,
        color: 'var(--text-primary)',
        width: '100%',
        ...style,
      }}
      {...rest}
    />
  );
});
