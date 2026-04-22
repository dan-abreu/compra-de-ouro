-- Repair drift: ensure treasury/accounting columns required by runtime exist.
-- This migration is intentionally idempotent for tenant databases with mixed histories.

ALTER TABLE "Vault"
ADD COLUMN IF NOT EXISTS "openGoldAcquisitionCostUsd" DECIMAL(18, 4);

UPDATE "Vault"
SET "openGoldAcquisitionCostUsd" = 0
WHERE "openGoldAcquisitionCostUsd" IS NULL;

ALTER TABLE "Vault"
ALTER COLUMN "openGoldAcquisitionCostUsd" SET NOT NULL;

ALTER TABLE "SalesOrder"
ADD COLUMN IF NOT EXISTS "averageAcquisitionCostUsd" DECIMAL(18, 4);

UPDATE "SalesOrder"
SET "averageAcquisitionCostUsd" = 0
WHERE "averageAcquisitionCostUsd" IS NULL;

ALTER TABLE "SalesOrder"
ALTER COLUMN "averageAcquisitionCostUsd" SET NOT NULL;

ALTER TABLE "SalesOrder"
ADD COLUMN IF NOT EXISTS "realizedProfitUsd" DECIMAL(18, 4);

UPDATE "SalesOrder"
SET "realizedProfitUsd" = 0
WHERE "realizedProfitUsd" IS NULL;

ALTER TABLE "SalesOrder"
ALTER COLUMN "realizedProfitUsd" SET NOT NULL;
