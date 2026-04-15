import { PrismaClient } from "@prisma/client";

import { getTenantPrismaOrThrow } from "./tenant/tenant-context.js";

const fallbackPrisma = new PrismaClient();

const prismaProxy = new Proxy(fallbackPrisma as PrismaClient, {
  get(target, prop, receiver) {
    const tenantPrisma = (() => {
      try {
        return getTenantPrismaOrThrow();
      } catch {
        return null;
      }
    })();

    const activeClient = tenantPrisma ?? target;
    return Reflect.get(activeClient, prop, receiver);
  }
});

export const prisma = prismaProxy as PrismaClient;
export const rootPrisma = fallbackPrisma;
