import { ui } from '../styles/classes';
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  className?: string;
}

const variantStyles = {
  default: 'bg-raised text-muted',
  primary: 'bg-accent-soft text-accent',
  success: 'bg-[var(--positive-soft)] text-[var(--positive)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  error: 'bg-[var(--negative-soft)] text-[var(--negative)]',
  neutral: 'bg-raised text-foreground',
};

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={ui(
        `whitespace-nowrap shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${variantStyles[variant]} ${className}`,
      )}
    >
      {children}
    </span>
  );
}
