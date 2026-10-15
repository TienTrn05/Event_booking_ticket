import type { Prisma } from '@prisma/client';
export class OrganizerBlockRepository {
  async change(
    db: Prisma.TransactionClient,
    userId: string,
    organizationId: string,
    blocked: boolean,
  ) {
    const where = { userId: BigInt(userId), organizationId: BigInt(organizationId) };
    if (blocked) await db.organizationBlock.createMany({ data: [where], skipDuplicates: true });
    else await db.organizationBlock.deleteMany({ where });
    return { blocked };
  }
  async list(db: Prisma.TransactionClient, userId: string, page: number, pageSize: number) {
    const where = { userId: BigInt(userId) };
    const rows = await db.organizationBlock.findMany({
      where,
      select: {
        createdAt: true,
        organization: { select: { publicId: true, name: true, avatar: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { organizationId: 'desc' }],
      take: pageSize,
      skip: (page - 1) * pageSize,
    });
    return {
      items: rows.map(({ organization, createdAt }) => ({
        id: organization.publicId,
        name: organization.name,
        avatar: organization.avatar,
        blockedAt: createdAt.toISOString(),
      })),
      total: await db.organizationBlock.count({ where }),
    };
  }
}
