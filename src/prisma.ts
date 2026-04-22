import { PrismaClient } from "@prisma/client";

import { getTenantPrismaOrThrow } from "./tenant/tenant-context.js";

export class MissingTenantPrismaContextError extends Error {
  constructor() {
    super("Tenant Prisma context missing. Use rootPrisma explicitly for global operations.");
    this.name = "MissingTenantPrismaContextError";
  }
}

const rootPrismaClient = new PrismaClient();

const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    let tenantPrisma: PrismaClient;
    try {
      tenantPrisma = getTenantPrismaOrThrow();
    } catch {
      throw new MissingTenantPrismaContextError();
    }

    const value = Reflect.get(tenantPrisma as PrismaClient, prop);
    if (typeof value === "function") {
      return value.bind(tenantPrisma);
    }

    return value;
  }
});

export const prisma = prismaProxy as PrismaClient;
export const rootPrisma = rootPrismaClient;
