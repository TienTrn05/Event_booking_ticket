import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { useReducedMotion } from '../../shared/motion/useReducedMotion';

export interface OrbInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'placeholder' | 'size'
> {
  'aria-label': string;
  placeholders: readonly string[];
  compact?: boolean;
  containerClassName?: string;
  endAdornment?: ReactNode;
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function getVisibility() {
  return document.visibilityState !== 'hidden';
}

/** The visual owns its timers; search value, autocomplete and requests belong to its caller. */
export const OrbInput = forwardRef<HTMLInputElement, OrbInputProps>(function OrbInput(
  {
    placeholders,
    compact = false,
    containerClassName = '',
    endAdornment,
    className = '',
    value,
    defaultValue,
    onChange,
    onFocus,
    onBlur,
    disabled,
    readOnly,
    type = 'search',
    ...props
  },
  inputRef,
) {
  const root = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [focused, setFocused] = useState(false);
  const [hasValue, setHasValue] = useState(() => String(value ?? defaultValue ?? '').length > 0);
  const [imageFailed, setImageFailed] = useState(false);
  const reducedMotion = useReducedMotion();
  const pageVisible = useSyncExternalStore(subscribeVisibility, getVisibility, () => true);
  const filled = value !== undefined ? String(value).length > 0 : hasValue;
  const animate = inView && pageVisible && !reducedMotion && !disabled;
  const typePlaceholder = animate && !focused && !filled && !disabled && !readOnly;
  const choices = placeholders.filter((text) => text.length > 0);
  const key = JSON.stringify(choices);
  const [progress, setProgress] = useState({ key, index: 0, length: 0 });
  const index = progress.key === key ? progress.index : 0;
  const length = progress.key === key ? progress.length : 0;
  const chars = Array.from(choices[index] ?? choices[0] ?? '');
  const typing = length < chars.length;

  useEffect(() => {
    const node = root.current;
    if (!node || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(Boolean(entry?.isIntersecting));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!typePlaceholder || !choices.length) return;
    const timer = window.setTimeout(
      () => {
        setProgress({
          key,
          index: typing ? index : (index + 1) % choices.length,
          length: typing ? length + 1 : 0,
        });
      },
      typing ? 75 : 2200,
    );
    return () => window.clearTimeout(timer);
  }, [typePlaceholder, choices.length, key, index, length, typing]);

  const placeholder = typePlaceholder
    ? `${chars.slice(0, length).join('')}${typing ? '|' : ''}`
    : (choices[0] ?? '');

  return (
    <div
      ref={root}
      className={`orb-input-shell ${compact ? 'orb-input-compact' : ''} ${containerClassName}`}
    >
      <span className="orb-input-orb" aria-hidden="true">
        {animate && !imageFailed && (
          <img
            src="/visuals/search-orb.gif"
            alt=""
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setImageFailed(true)}
          />
        )}
      </span>
      <span className="orb-input-divider" aria-hidden="true" />
      <input
        {...props}
        ref={inputRef}
        type={type}
        disabled={disabled}
        readOnly={readOnly}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        data-testid="orb-input"
        className={`orb-input-field ${className}`}
        onChange={(event) => {
          setHasValue(event.target.value.length > 0);
          onChange?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
      {endAdornment}
    </div>
  );
});

export default OrbInput;
