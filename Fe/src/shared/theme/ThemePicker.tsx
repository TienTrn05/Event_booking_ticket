import { ui } from '../styles/classes';
import { useEffect, useId, useRef, useState } from 'react';
import { Monitor, Moon, Sun, Check, ChevronDown } from 'lucide-react';
import { applyTheme, readThemePreference, parseThemePreference, THEME_STORAGE_KEY } from './theme';
import type { ThemePreference } from './theme';
const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;
export function ThemePicker() {
  const [preference, setPreference] = useState(readThemePreference);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(preference, media.matches);
    const sync = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY || e.key === null)
        setPreference(parseThemePreference(e.newValue));
    };
    update();
    media.addEventListener('change', update);
    window.addEventListener('storage', sync);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('storage', sync);
    };
  }, [preference]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const select = (value: ThemePreference) => {
    setPreference(value);
    applyTheme(value, window.matchMedia('(prefers-color-scheme: dark)').matches);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      /* Theme still works without storage. */
    }
    setOpen(false);
    trigger.current?.focus();
  };
  const current = options.find((option) => option.value === preference) ?? options[2];
  const Icon = current.icon;
  return (
    <div
      className={ui('theme-control')}
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className={ui('theme-trigger')}
        aria-label="Chọn giao diện"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Icon size={16} />
        <span>{current.label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label="Giao diện"
          className={ui('theme-options !animate-menu-arrive')}
          onKeyDown={(e) => {
            const buttons = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
            );
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
              trigger.current?.focus();
            }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
              e.preventDefault();
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? buttons.length - 1
                    : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
              buttons[next]?.focus();
            }
          }}
        >
          {options.map((option) => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.value}
                role="menuitemradio"
                aria-checked={preference === option.value}
                onClick={() => select(option.value)}
              >
                <OptionIcon size={17} />
                <span>{option.label}</span>
                {preference === option.value && <Check size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
