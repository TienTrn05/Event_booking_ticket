import { z } from 'zod';
import { numericId, versionSchema as version } from '../../../shared/validation/common.schema.js';
import { paginationShape } from '../../../shared/validation/common.schema.js';
const reviewStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'WITHDRAWN']);
export const ownReviewQuery = z
  .object({ ...paginationShape, status: reviewStatus.optional() })
  .strict();
export const reviewHistoryQuery = ownReviewQuery
  .extend({ eventId: numericId.optional(), organizationId: numericId.optional() })
  .strict();
export type ReviewHistoryQuery = z.infer<typeof reviewHistoryQuery>;
const label = z.string().trim().min(1).max(120);
export const draftInput = z
  .object({
    organizationId: numericId,
    ticketingMode: z.enum(['NUMBERED', 'QUANTITY']).default('NUMBERED'),
    title: z.string().trim().min(1).max(180),
    categoryId: numericId,
    description: z.string().trim().min(1).max(10000),
    minimumAge: z.number().int().min(1).max(32767).nullable().default(null),
  })
  .strict();
export const editInput = draftInput
  .omit({ organizationId: true, ticketingMode: true })
  .extend({ version })
  .strict();
const rectangle = z
  .object({
    x: z.number().finite().min(0).max(9999999.999).multipleOf(0.001),
    y: z.number().finite().min(0).max(9999999.999).multipleOf(0.001),
    width: z.number().finite().min(0.001).max(9999999.999).multipleOf(0.001),
    height: z.number().finite().min(0.001).max(9999999.999).multipleOf(0.001),
  })
  .strict();
export const layoutInput = z
  .object({
    version,
    venueId: numericId,
    stage: rectangle.nullable().default(null),
    blocked: z.array(rectangle).max(100).default([]),
    seats: z
      .array(
        rectangle
          .extend({
            section: label,
            row: z.string().trim().min(1).max(40),
            number: z.string().trim().min(1).max(40),
          })
          .strict(),
      )
      .min(1)
      .max(5000),
  })
  .strict();
const instant = z.iso.datetime({ offset: true });
export const zoneLayoutInput = z
  .object({
    version,
    venueId: numericId,
    stage: rectangle.nullable().default(null),
    blocked: z.array(rectangle).max(100).default([]),
    zones: z
      .array(
        rectangle
          .extend({
            code: z
              .string()
              .trim()
              .regex(/^[A-Za-z0-9_-]{1,40}$/),
            name: label,
            capacity: z.number().int().min(1).max(100000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export const zonePricingInput = z
  .object({
    version,
    prices: z
      .array(
        z
          .object({
            sectionId: numericId,
            ticketTypeId: numericId,
            priceMinor: z
              .string()
              .regex(/^[1-9]\d{0,15}$/)
              .refine((v) => BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER)),
            currency: z.literal('VND'),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export type ZoneLayoutInput = z.infer<typeof zoneLayoutInput>;
export type ZonePricingInput = z.infer<typeof zonePricingInput>;
export const sessionInput = z
  .object({
    version,
    layoutId: numericId,
    startsAt: instant,
    endsAt: instant,
    saleOpensAt: instant,
    saleClosesAt: instant,
    counterOpensAt: instant,
    counterClosesAt: instant,
    admissionOpensAt: instant,
    admissionClosesAt: instant,
  })
  .strict();
export const typeInput = z
  .object({ version, code: z.string().trim().min(1).max(48), name: label })
  .strict();
export const pricingInput = z
  .object({
    version,
    prices: z
      .array(
        z
          .object({
            seatId: numericId,
            ticketTypeId: numericId,
            priceMinor: z
              .string()
              .regex(/^[1-9]\d{0,15}$/)
              .refine((v) => BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER)),
            currency: z.literal('VND'),
          })
          .strict(),
      )
      .min(1)
      .max(5000),
  })
  .strict();
export const versionInput = z.object({ version }).strict();
export const reasonCode = z.enum([
  'REVIEW_EXPIRED',
  'REVIEW_REJECTED',
  'MISSING_INFORMATION',
  'INVALID_CONFIGURATION',
  'OTHER',
]);
export const reasonDraft = z
  .object({
    version,
    reasonCode,
    reason: z.string().trim().max(4000),
    guidance: z.string().trim().max(2000).default(''),
  })
  .strict();
export const reviewDecision = z
  .object({
    version,
    reason: z.string().trim().min(1).max(4000),
    guidance: z.string().trim().max(2000).default(''),
    reasonCode: reasonCode.optional(),
  })
  .strict();
export type LayoutInput = z.infer<typeof layoutInput>;
export type SessionInput = z.infer<typeof sessionInput>;
export type DraftInput = z.infer<typeof draftInput>;
export type PricingInput = z.infer<typeof pricingInput>;
