import type { PrismaClient } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantPrisma?: PrismaClient;
      userId?: string;
    }
  }
}

export {};
