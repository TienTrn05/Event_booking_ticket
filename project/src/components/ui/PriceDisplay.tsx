interface PriceDisplayProps {
  price: number;
  currency: string;
  size?: 'sm' | 'md' | 'lg';
}

function formatPrice(price: number, currency: string) {
  if (currency === 'VND') {
    return price.toLocaleString('vi-VN') + ' ₫';
  }
  return currency + ' ' + price.toLocaleString('en-US');
}

const sizeStyles = {
  sm: { label: 'text-xs', value: 'text-sm' },
  md: { label: 'text-xs', value: 'text-base' },
  lg: { label: 'text-sm', value: 'text-xl' },
};

export default function PriceDisplay({ price, currency, size = 'md' }: PriceDisplayProps) {
  return (
    <div className="flex flex-col">
      <span className={`text-ink-400 font-medium ${sizeStyles[size].label}`}>Starting from</span>
      <span className={`text-ink-900 font-bold ${sizeStyles[size].value}`}>
        {formatPrice(price, currency)}
      </span>
    </div>
  );
}
