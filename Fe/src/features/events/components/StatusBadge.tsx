import Badge from '../../../shared/ui/Badge';
import { useLocale } from '../../../shared/i18n/LocaleContext';

type Status = 'on-sale' | 'few-left' | 'sold-out' | 'coming-soon';
const config: Record<
  Status,
  { vi: string; en: string; variant: 'success' | 'warning' | 'error' | 'default' }
> = {
  'on-sale': { vi: 'Đang mở bán', en: 'On sale', variant: 'success' },
  'few-left': { vi: 'Sắp hết vé', en: 'Few tickets left', variant: 'warning' },
  'sold-out': { vi: 'Hết vé', en: 'Sold out', variant: 'error' },
  'coming-soon': { vi: 'Sắp mở bán', en: 'Coming soon', variant: 'default' },
};
export default function StatusBadge({ status }: { status: Status }) {
  const { t } = useLocale();
  const { vi, en, variant } = config[status];
  return <Badge variant={variant}>{t(vi, en)}</Badge>;
}
