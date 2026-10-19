import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent hover:bg-accent-hover active:bg-[var(--accent-active)] shadow-sm',
  secondary: 'bg-raised text-foreground hover:bg-accent-soft border border-line',
  ghost: 'text-foreground hover:bg-raised',
  outline: 'border border-[var(--control-line)] text-foreground hover:bg-raised',
  danger: 'bg-[var(--negative)] text-[var(--on-negative)] hover:opacity-90',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-11 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      className = '',
      children,
      loading = false,
      disabled,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={`whitespace-nowrap shrink-0 inline-flex items-center justify-center font-semibold rounded-[10px] transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
