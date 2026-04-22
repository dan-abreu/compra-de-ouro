import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { PrismaClient as MasterPrismaClient } from "../generated/master-client/index.js";

const master = new MasterPrismaClient();

const SQL_STATEMENTS = [
  `DO $$ BEGIN CREATE TYPE "LoanDirection" AS ENUM ('RECEIVED', 'GRANTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "CounterpartyType" AS ENUM ('CLIENT', 'SUPPLIER', 'EMPLOYEE', 'THIRD_PARTY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "MonthlyCostType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "CostBaseType" AS ENUM ('CURRENT_BALANCE', 'ORIGINAL_PRINCIPAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "SettlementExpectation" AS ENUM ('CASH', 'GOLD', 'MIXED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "LoanBookEntry"
      ADD COLUMN IF NOT EXISTS "direction" "LoanDirection" NOT NULL DEFAULT 'GRANTED',
      ADD COLUMN IF NOT EXISTS "counterpartyType" "CounterpartyType" NOT NULL DEFAULT 'THIRD_PARTY',
      ADD COLUMN IF NOT EXISTS "supplierId" TEXT,
      ADD COLUMN IF NOT EXISTS "counterpartyDocument" VARCHAR(80),
      ADD COLUMN IF NOT EXISTS "principalAmountUsd" DECIMAL(18,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "monthlyCostType" "MonthlyCostType" NOT NULL DEFAULT 'NONE',
      ADD COLUMN IF NOT EXISTS "monthlyRatePercent" DECIMAL(18,4),
      ADD COLUMN IF NOT EXISTS "monthlyFixedCostUsd" DECIMAL(18,4),
      ADD COLUMN IF NOT EXISTS "costBaseType" "CostBaseType",
      ADD COLUMN IF NOT EXISTS "settlementExpectation" "SettlementExpectation" NOT NULL DEFAULT 'CASH',
      ADD COLUMN IF NOT EXISTS "startDate" DATE NOT NULL DEFAULT CURRENT_DATE,
      ADD COLUMN IF NOT EXISTS "dueDate" DATE,
      ADD COLUMN IF NOT EXISTS "billingDay" INTEGER`,
  `UPDATE "LoanBookEntry" SET "principalAmountUsd" = ABS("frontMoneyUsd") WHERE "principalAmountUsd" = 0`,
  `CREATE INDEX IF NOT EXISTS "LoanBookEntry_supplierId_idx" ON "LoanBookEntry"("supplierId")`,
  `CREATE INDEX IF NOT EXISTS "LoanBookEntry_direction_idx" ON "LoanBookEntry"("direction")`,
  `CREATE INDEX IF NOT EXISTS "LoanBookEntry_counterpartyType_idx" ON "LoanBookEntry"("counterpartyType")`,
  `CREATE INDEX IF NOT EXISTS "LoanBookEntry_startDate_idx" ON "LoanBookEntry"("startDate")`,
  `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'LoanBookEntry_supplierId_fkey'
      ) THEN
        ALTER TABLE "LoanBookEntry"
          ADD CONSTRAINT "LoanBookEntry_supplierId_fkey"
          FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$`
] as const;

async function main() {
  const tenants = await master.tenant.findMany({
    select: { id: true, companyName: true, databaseUrl: true },
    orderBy: { createdAt: "asc" }
  });

  for (const tenant of tenants) {
    const prisma = new PrismaClient({ datasourceUrl: tenant.databaseUrl });

    try {
      for (const statement of SQL_STATEMENTS) {
        await prisma.$executeRawUnsafe(statement);
      }
      console.log(`[ok] ${tenant.id} (${tenant.companyName})`);
    } catch (error) {
      console.error(`[error] ${tenant.id} (${tenant.companyName})`, error);
    } finally {
      await prisma.$disconnect();
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await master.$disconnect();
  });
