-- Irreversible business rule migration:
-- Remove all fine-gold storage fields and keep only physicalWeight + purityPercentage + goldState.

BEGIN;

ALTER TABLE "PurchaseOrder"
  DROP COLUMN IF EXISTS "fine_gold_weight";

ALTER TABLE "SalesOrder"
  DROP COLUMN IF EXISTS "fine_gold_weight";

ALTER TABLE "VaultLedger"
  DROP COLUMN IF EXISTS "fine_gold_weight";

COMMIT;
