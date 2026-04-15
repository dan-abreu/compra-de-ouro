import { AsyncLocalStorage } from "node:async_hooks";

import { PrismaClient } from "@prisma/client";

type TenantRequestContext = {
  tenantId: string;
  tenantDatabaseUrl: string;
  prisma: PrismaClient;
};

const tenantContextStorage = new AsyncLocalStorage<TenantRequestContext>();

export const runWithTenantContext = <T>(
  context: TenantRequestContext,
  callback: () => T
): T => {
  return tenantContextStorage.run(context, callback);
};

export const getTenantContext = (): TenantRequestContext | undefined => {
  return tenantContextStorage.getStore();
};

export const getTenantPrismaOrThrow = (): PrismaClient => {
  const context = getTenantContext();
  if (!context) {
    throw new Error("TENANT_CONTEXT_MISSING");
  }

  return context.prisma;
};
