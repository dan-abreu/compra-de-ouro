-- Safe migration: refactor legacy weight/currency columns to
-- physicalWeight + purityPercentage + fineGoldWeight + gold_state model.
-- This migration is designed to preserve historical data.
-- NOTE (repair): DailyRate/Vault/Usd renames were already applied to the DB
-- via an earlier db push, so only the genuinely missing steps are here.

-- 1) Enums required by the new schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GoldState') THEN
    CREATE TYPE "GoldState" AS ENUM ('BURNED', 'MELTED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VaultLedgerEntryType') THEN
    CREATE TYPE "VaultLedgerEntryType" AS ENUM ('PURCHASE_IN', 'SALE_OUT', 'ADJUSTMENT');
  END IF;
END
$$;

-- 2) PurchaseOrder: add new columns.
ALTER TABLE "PurchaseOrder" ADD COLUMN "gold_state" "GoldState";
ALTER TABLE "PurchaseOrder" ADD COLUMN "physical_weight" DECIMAL(18,4);

-- Backfill with business rule for legacy records:
-- physical_weight comes from historical netWeight.
UPDATE "PurchaseOrder"
SET
  "gold_state" = COALESCE("gold_state", 'BURNED'::"GoldState"),
  "physical_weight" = COALESCE("physical_weight", "netWeight")
WHERE "gold_state" IS NULL OR "physical_weight" IS NULL;

ALTER TABLE "PurchaseOrder" ALTER COLUMN "gold_state" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "physical_weight" SET NOT NULL;

ALTER TABLE "PurchaseOrder" RENAME COLUMN "purityPercentage" TO "purity_percentage";
ALTER TABLE "PurchaseOrder" RENAME COLUMN "fineGoldWeight" TO "fine_gold_weight";

-- Remove superseded columns.
ALTER TABLE "PurchaseOrder" DROP COLUMN "grossWeight";
ALTER TABLE "PurchaseOrder" DROP COLUMN "netWeight";

-- 3) SalesOrder: add new columns.
ALTER TABLE "SalesOrder" ADD COLUMN "gold_state" "GoldState";
ALTER TABLE "SalesOrder" ADD COLUMN "physical_weight" DECIMAL(18,4);
ALTER TABLE "SalesOrder" ADD COLUMN "purity_percentage" DECIMAL(18,4);
ALTER TABLE "SalesOrder" ADD COLUMN "fine_gold_weight" DECIMAL(18,4);

-- Legacy sales only had fine gold. Preserve meaning with purity=100 and physical=fine.
UPDATE "SalesOrder"
SET
  "gold_state" = COALESCE("gold_state", 'MELTED'::"GoldState"),
  "physical_weight" = COALESCE("physical_weight", "fineGoldWeightSold"),
  "purity_percentage" = COALESCE("purity_percentage", 100.0000),
  "fine_gold_weight" = COALESCE("fine_gold_weight", "fineGoldWeightSold")
WHERE
  "gold_state" IS NULL
  OR "physical_weight" IS NULL
  OR "purity_percentage" IS NULL
  OR "fine_gold_weight" IS NULL;

ALTER TABLE "SalesOrder" ALTER COLUMN "gold_state" SET NOT NULL;
ALTER TABLE "SalesOrder" ALTER COLUMN "physical_weight" SET NOT NULL;
ALTER TABLE "SalesOrder" ALTER COLUMN "purity_percentage" SET NOT NULL;
ALTER TABLE "SalesOrder" ALTER COLUMN "fine_gold_weight" SET NOT NULL;

-- Remove superseded column.
ALTER TABLE "SalesOrder" DROP COLUMN "fineGoldWeightSold";

-- 4) New VaultLedger table for inventory trail.
CREATE TABLE "VaultLedger" (
  "id" TEXT NOT NULL,
  "vault_code" VARCHAR(32) NOT NULL DEFAULT 'MAIN',
  "entry_type" "VaultLedgerEntryType" NOT NULL,
  "gold_state" "GoldState" NOT NULL,
  "currency" "Currency" NOT NULL,
  "physical_weight" DECIMAL(18,4) NOT NULL,
  "purity_percentage" DECIMAL(18,4) NOT NULL,
  "fine_gold_weight" DECIMAL(18,4) NOT NULL,
  "total_amount_usd" DECIMAL(18,4) NOT NULL,
  "purchase_order_id" TEXT,
  "sales_order_id" TEXT,
  "notes" VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VaultLedger_vault_code_created_at_idx" ON "VaultLedger"("vault_code", "created_at");
CREATE INDEX "VaultLedger_entry_type_idx" ON "VaultLedger"("entry_type");
CREATE INDEX "VaultLedger_gold_state_idx" ON "VaultLedger"("gold_state");
CREATE INDEX "VaultLedger_purchase_order_id_idx" ON "VaultLedger"("purchase_order_id");
CREATE INDEX "VaultLedger_sales_order_id_idx" ON "VaultLedger"("sales_order_id");

