import { Minus, Plus } from 'lucide-react';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { formatPrice } from '../../../shared/utils/format';
import type { ZoneInventory } from '../api/checkout.api';
import { panelClass } from './CheckoutFrame';

export function ZonePicker({
  inventory,
  quantities,
  disabled,
  onChange,
}: {
  inventory: ZoneInventory;
  quantities: Record<string, number>;
  disabled: boolean;
  onChange: (id: string, quantity: number) => void;
}) {
  const { t } = useLocale();
  const total = Object.values(quantities).reduce((sum, value) => sum + value, 0);
  const { width, height, geometry } = inventory.layout;
  return (
    <div className="space-y-5">
      <div className={`${panelClass} overflow-hidden`}>
        <h2 className="mb-4 text-lg font-bold">{t('Sơ đồ khu vực', 'Zone map')}</h2>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="max-h-80 w-full rounded-xl bg-raised"
          role="img"
          aria-label={t('Vị trí các khu trong địa điểm', 'Zones within the venue')}
        >
          <title>
            {t('Sơ đồ khu vực từ đơn vị tổ chức', 'Zone layout provided by the organizer')}
          </title>
          {geometry.blocked?.map((rect, index) => (
            <rect key={index} {...rect} fill="var(--line)" />
          ))}
          {geometry.stage && (
            <g>
              <rect {...geometry.stage} rx={Math.min(width, height) * 0.006} fill="var(--muted)" />
              <text
                x={geometry.stage.x + geometry.stage.width / 2}
                y={geometry.stage.y + geometry.stage.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--surface)"
                fontSize={Math.min(geometry.stage.width / 8, geometry.stage.height / 3)}
              >
                {t('SÂN KHẤU', 'STAGE')}
              </text>
            </g>
          )}
          {inventory.items.map((zone) => (
            <g key={zone.sectionId}>
              <rect
                {...zone.geometry}
                rx={Math.min(width, height) * 0.006}
                fill={quantities[zone.sectionId] ? 'var(--accent)' : 'var(--accent-soft)'}
                stroke="var(--accent)"
                strokeWidth={Math.min(width, height) * 0.003}
              />
              <text
                x={zone.geometry.x + zone.geometry.width / 2}
                y={zone.geometry.y + zone.geometry.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={quantities[zone.sectionId] ? 'var(--on-accent)' : 'var(--accent)'}
                fontSize={Math.min(
                  zone.geometry.width / Math.max(zone.code.length, 4),
                  zone.geometry.height / 3,
                )}
              >
                {zone.code}
              </text>
            </g>
          ))}
        </svg>
        <p className="mt-3 text-xs leading-5 text-muted">
          {t(
            'Chọn số lượng ở danh sách bên dưới. Vé theo khu không có số ghế cố định.',
            'Select quantities below. Zone tickets do not have assigned seat numbers.',
          )}
        </p>
      </div>
      <div className="space-y-3">
        {inventory.items.map((zone) => {
          const quantity = quantities[zone.sectionId] ?? 0;
          return (
            <article
              key={zone.sectionId}
              className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}
            >
              <div className="min-w-0 flex-1">
                <span className="mb-2 inline-flex rounded-md bg-accent-soft px-2 py-1 text-xs font-bold text-accent">
                  {zone.code}
                </span>
                <h3 className="font-bold">{zone.name}</h3>
                <p className="mt-1 text-xs text-muted">
                  {zone.ticketTypeName} ·{' '}
                  {zone.available
                    ? t(
                        `Còn ${zone.available.toLocaleString('vi-VN')} vé`,
                        `${zone.available.toLocaleString('en-US')} available`,
                      )
                    : t('Tạm hết vé', 'Currently unavailable')}
                </p>
                <p className="mt-3 font-bold text-accent">
                  {formatPrice(zone.priceMinor, zone.currency)}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-line p-1">
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-raised disabled:opacity-30"
                  disabled={disabled || quantity === 0}
                  onClick={() => onChange(zone.sectionId, quantity - 1)}
                  aria-label={t(`Giảm vé ${zone.name}`, `Remove a ticket from ${zone.name}`)}
                >
                  <Minus size={17} />
                </button>
                <output
                  aria-label={t(`Số vé ${zone.name}`, `Tickets for ${zone.name}`)}
                  className="min-w-8 text-center font-bold"
                >
                  {quantity}
                </output>
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-raised disabled:opacity-30"
                  disabled={disabled || total >= 6 || quantity >= zone.available}
                  onClick={() => onChange(zone.sectionId, quantity + 1)}
                  aria-label={t(`Thêm vé ${zone.name}`, `Add a ticket for ${zone.name}`)}
                >
                  <Plus size={17} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!inventory.items.length && (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
          {t('Suất này chưa có khu mở bán.', 'No zones are on sale for this session.')}
        </p>
      )}
    </div>
  );
}
