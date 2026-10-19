/** Compare validated BIGINT strings without losing precision through Number(). */
export function compareIds(left: string, right: string): number {
  const a = BigInt(left),
    b = BigInt(right);
  return a < b ? -1 : a > b ? 1 : 0;
}
