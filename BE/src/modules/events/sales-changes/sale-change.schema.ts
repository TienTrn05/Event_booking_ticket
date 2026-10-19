import { z } from 'zod';
import { numericId, versionSchema } from '../../../shared/validation/common.schema.js';
import {
  layoutInput,
  zoneLayoutInput,
  zonePricingInput,
} from '../management/event-management.schema.js';
const base = {
  version: versionSchema,
  sessionId: numericId,
  reason: z.string().trim().min(3).max(2000),
};
const price = {
  ticketTypeId: numericId,
  priceMinor: zonePricingInput.shape.prices.element.shape.priceMinor,
};
export const saleChangeInput = z.discriminatedUnion('kind', [
  z
    .object({
      ...base,
      kind: z.literal('NEW_SALE_WAVE'),
      saleOpensAt: z.iso.datetime({ offset: true }),
      saleClosesAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal('CAPACITY'),
      seats: z.array(layoutInput.shape.seats.element.extend(price).strict()).max(5000).default([]),
      zones: z
        .array(zoneLayoutInput.shape.zones.element.extend(price).strict())
        .max(100)
        .default([]),
      increases: z
        .array(
          z
            .object({ sectionId: numericId, capacity: z.number().int().min(1).max(100000) })
            .strict(),
        )
        .max(100)
        .default([]),
    })
    .strict(),
]);
export type SaleChangeInput = z.infer<typeof saleChangeInput>;
