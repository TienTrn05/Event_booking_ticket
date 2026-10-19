import { z } from 'zod';
import { numericId } from '../../../shared/validation/common.schema.js';

const coordinate = z.union([z.number().finite(), z.string().regex(/^-?[0-9]+(?:\.[0-9]+)?$/)]);
export const inventorySnapshotSchema = z
  .object({
    sessionId: numericId,
    serverTime: z.union([z.date(), z.iso.datetime()]),
    items: z.array(
      z
        .object({
          id: numericId,
          priceMinor: z.string().regex(/^[0-9]+$/),
          currency: z.string().length(3),
          label: z.string(),
          x: coordinate,
          y: coordinate,
          ticketTypeCode: z.string(),
          ticketTypeName: z.string(),
          availability: z.enum(['AVAILABLE', 'HELD', 'SOLD', 'BLOCKED']),
        })
        .strict(),
    ),
  })
  .strict();

export type InventorySnapshot = z.infer<typeof inventorySnapshotSchema>;
export type InventorySeat = InventorySnapshot['items'][number];
