interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  className?: string;
}

const variantStyles = {
  default: 'bg-ink-100 text-ink-700',
  primary: 'bg-primary-100 text-primary-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-sky-100 text-sky-700',
  error: 'bg-rose-100 text-rose-700',
  neutral: 'bg-ink-800 text-white',
};

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
