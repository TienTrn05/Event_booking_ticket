import { z } from 'zod';
import {
  numericId,
  paginationShape,
  versionSchema,
} from '../../shared/validation/common.schema.js';
const reason = z.string().trim().min(5).max(500);
const codes = z
  .array(z.string().regex(/^[a-z][a-z0-9_.]{1,79}$/))
  .max(100)
  .refine((v) => new Set(v).size === v.length, 'Duplicate permission')
  .transform((v) => v.sort());
export const createRoleInput = z
  .object({
    code: z.string().regex(/^CUSTOM_[A-Z][A-Z0-9_]{1,39}$/),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).default(''),
    baseRole: z.enum(['CUSTOMER', 'ORGANIZER', 'ADMIN']),
    permissionCodes: codes,
    reason,
  })
  .strict();
export const updateRoleInput = createRoleInput
  .omit({ code: true, baseRole: true })
  .extend({ version: versionSchema });
export const archiveRoleInput = z.object({ version: versionSchema, reason }).strict();
export const assignmentInput = z
  .object({ rolesVersion: versionSchema, roleVersion: versionSchema, reason })
  .strict();
export const rolesQuery = z
  .object({ ...paginationShape, status: z.enum(['ACTIVE', 'ARCHIVED']).optional() })
  .strict();
export const usersQuery = z
  .object({
    ...paginationShape,
    search: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine((v) => v.length >= 2 || /^[1-9]$/.test(v), 'Use an ID or at least two characters'),
  })
  .strict();
export const auditQuery = z
  .object({ ...paginationShape, userId: numericId.optional(), roleId: numericId.optional() })
  .strict();
export type CreateRoleInput = z.infer<typeof createRoleInput>;
export type UpdateRoleInput = z.infer<typeof updateRoleInput>;
export type AssignmentInput = z.infer<typeof assignmentInput>;
export type RolesQuery = z.infer<typeof rolesQuery>;
export type UsersQuery = z.infer<typeof usersQuery>;
export type AuditQuery = z.infer<typeof auditQuery>;
export interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  baseRole: 'CUSTOMER' | 'ORGANIZER' | 'ADMIN';
  status: 'ACTIVE' | 'ARCHIVED';
  version: number;
  system: boolean;
  userCount: number;
  permissionCodes: string[];
}
export interface ChangeResult {
  auditId: string;
  resourceType: string;
  resourceId: string;
  version: number;
}
