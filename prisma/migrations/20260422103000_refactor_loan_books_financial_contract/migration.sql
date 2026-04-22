CREATE TYPE "LoanDirection" AS ENUM ('RECEIVED', 'GRANTED');
CREATE TYPE "CounterpartyType" AS ENUM ('CLIENT', 'SUPPLIER', 'EMPLOYEE', 'THIRD_PARTY');
CREATE TYPE "MonthlyCostType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED');
CREATE TYPE "CostBaseType" AS ENUM ('CURRENT_BALANCE', 'ORIGINAL_PRINCIPAL');
CREATE TYPE "SettlementExpectation" AS ENUM ('CASH', 'GOLD', 'MIXED');

ALTER TABLE "LoanBookEntry"
  ADD COLUMN "direction" "LoanDirection" NOT NULL DEFAULT 'GRANTED',
  ADD COLUMN "counterpartyType" "CounterpartyType" NOT NULL DEFAULT 'THIRD_PARTY',
  ADD COLUMN "supplierId" TEXT,
  ADD COLUMN "counterpartyDocument" VARCHAR(80),
  ADD COLUMN "principalAmountUsd" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "monthlyCostType" "MonthlyCostType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "monthlyRatePercent" DECIMAL(18,4),
  ADD COLUMN "monthlyFixedCostUsd" DECIMAL(18,4),
  ADD COLUMN "costBaseType" "CostBaseType",
  ADD COLUMN "settlementExpectation" "SettlementExpectation" NOT NULL DEFAULT 'CASH',
  ADD COLUMN "startDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN "dueDate" DATE,
  ADD COLUMN "billingDay" INTEGER;

UPDATE "LoanBookEntry"
SET "principalAmountUsd" = ABS("frontMoneyUsd")
WHERE "principalAmountUsd" = 0;

CREATE INDEX "LoanBookEntry_supplierId_idx" ON "LoanBookEntry"("supplierId");
CREATE INDEX "LoanBookEntry_direction_idx" ON "LoanBookEntry"("direction");
CREATE INDEX "LoanBookEntry_counterpartyType_idx" ON "LoanBookEntry"("counterpartyType");
CREATE INDEX "LoanBookEntry_startDate_idx" ON "LoanBookEntry"("startDate");

ALTER TABLE "LoanBookEntry"
  ADD CONSTRAINT "LoanBookEntry_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
