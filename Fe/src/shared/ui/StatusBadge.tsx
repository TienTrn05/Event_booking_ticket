import Badge from './Badge';

type Status = 'on-sale' | 'few-left' | 'sold-out' | 'coming-soon';

interface StatusBadgeProps {
  status: Status;
}

const config: Record<
  Status,
  { label: string; variant: 'success' | 'warning' | 'error' | 'default' }
> = {
  'on-sale': { label: 'On Sale', variant: 'success' },
  'few-left': { label: 'Few Tickets Left', variant: 'warning' },
  'sold-out': { label: 'Sold Out', variant: 'error' },
  'coming-soon': { label: 'Coming Soon', variant: 'default' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}
