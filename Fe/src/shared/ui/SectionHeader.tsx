import type { ReactNode } from 'react';

/** One heading rhythm for sections at the same level. Feature color belongs to its parent. */
export function SectionHeader({
  title,
  eyebrow,
  description,
  icon,
  compact = false,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 max-w-2xl" data-reveal="heading">
      {eyebrow && (
        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-accent sm:text-[11px]">
          {eyebrow}
        </p>
      )}
      <div className="flex items-center gap-3">
        {icon && (
          <span
            className="section-signature flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-accent"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <h2
          className={`${compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-[28px]'} font-bold leading-tight tracking-tight text-foreground`}
        >
          {title}
        </h2>
      </div>
      {description && <p className="mt-3 max-w-xl text-sm leading-6 text-muted">{description}</p>}
    </div>
  );
}
