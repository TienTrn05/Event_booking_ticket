export function formatPrice(price: string | number, currency: string): string {
  const amount = typeof price === 'string' && /^\d+$/.test(price) ? BigInt(price) : Number(price);
  if (currency === 'VND') {
    return amount.toLocaleString('vi-VN') + ' ₫';
  }
  return currency + ' ' + amount.toLocaleString('en-US');
}
