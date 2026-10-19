import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { useLocale } from './LocaleContext';

export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div
      className="language-control relative"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        ref={trigger}
        className="language-trigger"
        aria-label={t('Ngôn ngữ', 'Language')}
        title={t('Ngôn ngữ', 'Language')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Languages size={18} aria-hidden="true" />
        {!compact && (
          <>
            <span>{locale.toUpperCase()}</span>
            <ChevronDown size={13} aria-hidden="true" />
          </>
        )}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={t('Ngôn ngữ', 'Language')}
          className="language-options"
          onKeyDown={(event) => {
            const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              trigger.current?.focus();
            }
            if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              buttons[
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? buttons.length - 1
                    : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
                      buttons.length
              ]?.focus();
            }
          }}
        >
          {(
            [
              { code: 'vi', name: 'Tiếng Việt' },
              { code: 'en', name: 'English' },
            ] as const
          ).map(({ code, name }) => (
            <button
              type="button"
              key={code}
              role="menuitemradio"
              aria-checked={locale === code}
              data-locale={code}
              onClick={() => {
                setLocale(code);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <span className="language-code">{code.toUpperCase()}</span>
              <span>{name}</span>
              {locale === code && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
