import { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

const ORDER_CANCEL_SECURITY_HASH_KEY = "ORDER_CANCEL_SECURITY_HASH";

export const getOrderCancelSecurityConfig = async (db: DbClient) => {
  return db.securityConfig.findUnique({
    where: { key: ORDER_CANCEL_SECURITY_HASH_KEY },
    select: { value: true, updatedById: true, updatedAt: true }
  });
};

export const setOrderCancelSecurityPasswordHash = async (
  db: DbClient,
  input: { hash: string; updatedById: string }
) => {
  await db.securityConfig.upsert({
    where: { key: ORDER_CANCEL_SECURITY_HASH_KEY },
    update: { value: input.hash, updatedById: input.updatedById },
    create: { key: ORDER_CANCEL_SECURITY_HASH_KEY, value: input.hash, updatedById: input.updatedById }
  });
};
