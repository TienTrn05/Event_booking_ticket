import { ui } from '../styles/classes';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun, Check, ChevronDown, Sparkles, Pause } from 'lucide-react';
import { getThemePreference, setThemePreference, subscribeTheme } from './theme';
import { getMotionPreference, setMotionPreference, subscribeMotion } from '../motion/preference';
import type { ThemePreference } from './theme';
import { useLocale } from '../i18n/LocaleContext';
const options = [
  { value: 'light', label: 'Light', vi: 'Sáng', icon: Sun },
  { value: 'dark', label: 'Dark', vi: 'Tối', icon: Moon },
  { value: 'system', label: 'System', vi: 'Hệ thống', icon: Monitor },
] as const;
const motionOptions = [
  { value: 'full', label: 'Full motion', vi: 'Bật đầy đủ', icon: Sparkles },
  { value: 'reduced', label: 'Reduce motion', vi: 'Giảm chuyển động', icon: Pause },
  { value: 'system', label: 'Follow system', vi: 'Theo hệ thống', icon: Monitor },
] as const;
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();
  const preference = useSyncExternalStore(subscribeTheme, getThemePreference, () => 'system');
  const motionPreference = useSyncExternalStore(subscribeMotion, getMotionPreference, () => 'full');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
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
    setThemePreference(value);
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
        aria-label={t('Chọn giao diện', 'Choose theme')}
        title={t('Chọn giao diện', 'Choose theme')}
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
        {!compact && (
          <>
            <span className="hidden sm:inline">{t(current.vi, current.label)}</span>
            <ChevronDown size={14} className="hidden sm:block" />
          </>
        )}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={t('Giao diện', 'Theme')}
          className={ui('theme-options motion-full:animate-menu-arrive')}
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
          <div role="group" aria-label={t('Màu giao diện', 'Color theme')}>
            <p className="px-3 py-2 text-xs font-semibold text-muted">{t('Giao diện', 'Theme')}</p>
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
                  <span>{t(option.vi, option.label)}</span>
                  {preference === option.value && <Check size={16} />}
                </button>
              );
            })}
          </div>
          <div
            role="group"
            aria-label={t('Chuyển động', 'Motion')}
            className="mt-2 border-t border-line pt-2"
          >
            <p className="px-3 py-2 text-xs font-semibold text-muted">
              {t('Chuyển động', 'Motion')}
            </p>
            {motionOptions.map((option) => {
              const OptionIcon = option.icon;
              return (
                <button
                  key={option.value}
                  role="menuitemradio"
                  aria-checked={motionPreference === option.value}
                  onClick={() => {
                    setMotionPreference(option.value);
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                >
                  <OptionIcon size={17} />
                  <span>{t(option.vi, option.label)}</span>
                  {motionPreference === option.value && <Check size={16} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
