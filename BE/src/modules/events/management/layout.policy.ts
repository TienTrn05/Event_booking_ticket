import { AppError } from '../../../shared/errors/app-error.js';
import type { LayoutInput, ZoneLayoutInput } from './event-management.schema.js';
type Rect = { x: number; y: number; width: number; height: number };
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
export function validateLayout(
  input: LayoutInput,
  width: number,
  height: number,
  capacity: number,
) {
  if (input.seats.length > capacity)
    throw new AppError(422, 'LAYOUT_CAPACITY', 'Số ghế vượt sức chứa địa điểm.');
  const rectangles = [...input.blocked, ...(input.stage ? [input.stage] : []), ...input.seats];
  if (rectangles.some((r) => r.x + r.width > width || r.y + r.height > height))
    throw new AppError(422, 'LAYOUT_BOUNDS', 'Ghế/khu vực nằm ngoài khung địa điểm.');
  const labels = new Set<string>();
  for (const seat of input.seats) {
    const key = JSON.stringify([seat.section, seat.row, seat.number]);
    if (labels.has(key)) throw new AppError(422, 'DUPLICATE_SEAT', 'Nhãn ghế trùng nhau.');
    labels.add(key);
  }
  for (let i = 0; i < input.seats.length; i++) {
    const seat = input.seats[i]!;
    if (
      input.blocked.some((r) => overlap(seat, r)) ||
      (input.stage && overlap(seat, input.stage)) ||
      input.seats.slice(0, i).some((r) => overlap(seat, r))
    )
      throw new AppError(422, 'LAYOUT_OVERLAP', 'Ghế chồng lên ghế khác, sân khấu hoặc vùng cấm.');
  }
}
export function validateZoneLayout(
  input: ZoneLayoutInput,
  width: number,
  height: number,
  capacity: number,
) {
  if (input.zones.reduce((total, z) => total + z.capacity, 0) > Math.min(capacity, 100000))
    throw new AppError(422, 'LAYOUT_CAPACITY', 'Tổng sức chứa khu vượt giới hạn địa điểm.');
  if (new Set(input.zones.map((z) => z.code)).size !== input.zones.length)
    throw new AppError(422, 'DUPLICATE_ZONE', 'Mã khu trùng nhau.');
  const obstacles = [...input.blocked, ...(input.stage ? [input.stage] : [])];
  if ([...obstacles, ...input.zones].some((r) => r.x + r.width > width || r.y + r.height > height))
    throw new AppError(422, 'LAYOUT_BOUNDS', 'Khu vực nằm ngoài địa điểm.');
  for (let i = 0; i < input.zones.length; i++)
    if ([...obstacles, ...input.zones.slice(0, i)].some((r) => overlap(input.zones[i]!, r)))
      throw new AppError(422, 'LAYOUT_OVERLAP', 'Khu chồng lên khu khác, sân khấu hoặc vùng cấm.');
}
