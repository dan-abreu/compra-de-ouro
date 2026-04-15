import { PrismaClient } from "@prisma/client";

const tenantPrismaCache = new Map<string, PrismaClient>();

export const getOrCreateTenantPrisma = (databaseUrl: string): PrismaClient => {
  const cached = tenantPrismaCache.get(databaseUrl);
  if (cached) {
    return cached;
  }

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  tenantPrismaCache.set(databaseUrl, prisma);
  return prisma;
};

export const disconnectAllTenantPrismas = async () => {
  await Promise.all([...tenantPrismaCache.values()].map((client) => client.$disconnect()));
  tenantPrismaCache.clear();
};
