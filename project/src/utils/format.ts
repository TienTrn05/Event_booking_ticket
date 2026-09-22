export function formatPrice(price: number, currency: string): string {
  if (currency === 'VND') {
    return price.toLocaleString('vi-VN') + ' ₫';
  }
  return currency + ' ' + price.toLocaleString('en-US');
}
