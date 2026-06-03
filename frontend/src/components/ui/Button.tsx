import { forwardRef } from 'react';

type Variant = 'default' | 'primary' | 'ghost' | 'upload' | 'download';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  on?: boolean;
}

const variantClass: Record<Variant, string> = {
  default:  '',
  primary:  'primary',
  ghost:    'ghost',
  upload:   'upload-btn',
  download: 'download-btn',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', on, className = '', children, ...props }, ref) => {
    const cls = [
      'xcb-btn',
      variantClass[variant],
      on ? 'on' : '',
      className,
    ].filter(Boolean).join(' ');

    return (
      <button ref={ref} className={cls} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
