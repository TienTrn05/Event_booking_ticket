import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
export const fieldClass =
  'min-h-11 w-full rounded-[10px] border border-[var(--control-line)] bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60';
type FieldMeta = { label: string; hint?: string; error?: string };
export function Input({
  label,
  hint,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldMeta) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-semibold" htmlFor={inputId}>
        {label}
        {props.required && ' *'}
      </label>
      <input
        {...props}
        id={inputId}
        className={`${fieldClass} ${props.className ?? ''}`}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${inputId}-help` : undefined}
      />
      {(error || hint) && (
        <p
          id={`${inputId}-help`}
          className={`text-xs ${error ? 'text-[var(--negative)]' : 'text-muted'}`}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
export function Select({
  label,
  hint,
  error,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldMeta) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-semibold" htmlFor={inputId}>
        {label}
        {props.required && ' *'}
      </label>
      <select
        {...props}
        id={inputId}
        className={`${fieldClass} ${props.className ?? ''}`}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${inputId}-help` : undefined}
      >
        {children}
      </select>
      {(error || hint) && (
        <p
          id={`${inputId}-help`}
          className={`text-xs ${error ? 'text-[var(--negative)]' : 'text-muted'}`}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
export function Textarea({
  label,
  hint,
  error,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldMeta) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-semibold" htmlFor={inputId}>
        {label}
        {props.required && ' *'}
      </label>
      <textarea
        {...props}
        id={inputId}
        className={`${fieldClass} min-h-28 ${props.className ?? ''}`}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${inputId}-help` : undefined}
      />
      {(error || hint) && (
        <p
          id={`${inputId}-help`}
          className={`text-xs ${error ? 'text-[var(--negative)]' : 'text-muted'}`}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
