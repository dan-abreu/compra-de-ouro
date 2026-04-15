BEGIN;

ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_supplierId_fkey";
ALTER TABLE "SalesOrder" DROP CONSTRAINT IF EXISTS "SalesOrder_clientId_fkey";

ALTER TABLE "PurchaseOrder" RENAME COLUMN "supplierId" TO "clientId";
ALTER TABLE "SalesOrder" RENAME COLUMN "clientId" TO "supplierId";

ALTER INDEX IF EXISTS "PurchaseOrder_supplierId_idx" RENAME TO "PurchaseOrder_clientId_idx";
ALTER INDEX IF EXISTS "SalesOrder_clientId_idx" RENAME TO "SalesOrder_supplierId_idx";

UPDATE "PurchaseOrder"
SET "clientId" = NULL
WHERE "clientId" IS NOT NULL;

UPDATE "SalesOrder"
SET "supplierId" = NULL
WHERE "supplierId" IS NOT NULL;

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
