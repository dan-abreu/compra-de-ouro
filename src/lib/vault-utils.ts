import { Prisma, PrismaClient } from "@prisma/client";

export const getOrCreateMainVault = async (db: PrismaClient | Prisma.TransactionClient) => {
  const existing = await db.vault.findUnique({ where: { code: "MAIN" } });
  if (existing) {
    return existing;
  }

  return db.vault.create({
    data: {
      code: "MAIN",
      balanceGoldGrams: new Prisma.Decimal("0.0000"),
      balanceUsd: new Prisma.Decimal("0.0000"),
      balanceEur: new Prisma.Decimal("0.0000"),
      balanceSrd: new Prisma.Decimal("0.0000"),
      openGoldGrams: new Prisma.Decimal("0.0000"),
      openGoldAcquisitionCostUsd: new Prisma.Decimal("0.0000")
    }
  });
};
