import { Check, LockKeyhole } from 'lucide-react';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { formatPrice } from '../../../shared/utils/format';
import type { Seat } from '../api/checkout.api';
import { panelClass } from './CheckoutFrame';

export function NumberedSeatPicker({
  seats,
  selected,
  disabled,
  onToggle,
}: {
  seats: Seat[];
  selected: string[];
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  const { t } = useLocale();
  const groups = new Map<string, Seat[]>();
  for (const seat of seats)
    groups.set(seat.ticketTypeName, [...(groups.get(seat.ticketTypeName) ?? []), seat]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-[var(--control-line)] bg-surface" />
          {t('Còn trống', 'Available')}
        </span>
        <span className="inline-flex items-center gap-2">
          <Check size={14} className="text-accent" />
          {t('Đã chọn', 'Selected')}
        </span>
        <span className="inline-flex items-center gap-2">
          <LockKeyhole size={13} />
          {t('Đang giữ / không khả dụng', 'Held / unavailable')}
        </span>
      </div>
      <p className="text-xs leading-5 text-muted">
        {t(
          'Danh sách ghế được nhóm theo loại vé. Nhãn trên mỗi nút là vị trí ghế do đơn vị tổ chức cung cấp.',
          'Seats are grouped by ticket type. Each button shows the seat label provided by the organizer.',
        )}
      </p>
      {[...groups].map(([name, group]) => (
        <section key={name} className={panelClass}>
          <h2 className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
            <span>{name}</span>
            <span className="text-xs font-normal text-muted">
              {group.filter((seat) => seat.availability === 'AVAILABLE').length}{' '}
              {t('ghế trống', 'available')}
            </span>
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {group.map((seat) => {
              const picked = selected.includes(seat.id);
              const unavailable = seat.availability !== 'AVAILABLE';
              return (
                <button
                  type="button"
                  key={seat.id}
                  aria-pressed={picked}
                  aria-label={`${seat.label} · ${formatPrice(seat.priceMinor, seat.currency)} · ${picked ? t('Đã chọn', 'Selected') : unavailable ? t('Không khả dụng', 'Unavailable') : t('Còn trống', 'Available')}`}
                  disabled={disabled || unavailable || (!picked && selected.length >= 6)}
                  className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold transition disabled:cursor-not-allowed ${picked ? 'border-accent bg-accent text-on-accent' : unavailable ? 'border-line bg-raised text-muted opacity-60' : 'border-[var(--control-line)] bg-surface hover:border-accent hover:bg-accent-soft'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]`}
                  onClick={() => onToggle(seat.id)}
                >
                  <span className="flex max-w-full items-center gap-1 break-all text-center">
                    {picked ? <Check size={12} /> : unavailable ? <LockKeyhole size={12} /> : null}
                    {seat.label}
                  </span>
                  <span className={`text-[10px] font-normal ${picked ? '' : 'text-muted'}`}>
                    {formatPrice(seat.priceMinor, seat.currency)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {!seats.length && (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
          {t('Suất này chưa có ghế mở bán.', 'No seats are on sale for this session.')}
        </p>
      )}
    </div>
  );
}
