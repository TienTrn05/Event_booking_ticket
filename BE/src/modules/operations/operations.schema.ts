import { z } from 'zod';

export const statisticsQuery = z
  .object({
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine((q) => !q.from || !q.to || new Date(q.from) < new Date(q.to), {
    message: 'from phải trước to',
    path: ['to'],
  });

export type StatisticsQuery = z.infer<typeof statisticsQuery>;
