BEGIN;

ALTER TABLE "Client"
  ALTER COLUMN "documentId" DROP NOT NULL;

ALTER TABLE "Supplier"
  ALTER COLUMN "documentId" DROP NOT NULL;

ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_clientId_fkey";
ALTER TABLE "SalesOrder" DROP CONSTRAINT IF EXISTS "SalesOrder_supplierId_fkey";

ALTER TABLE "PurchaseOrder" RENAME COLUMN "clientId" TO "supplierId";
ALTER TABLE "SalesOrder" RENAME COLUMN "supplierId" TO "clientId";

ALTER INDEX IF EXISTS "PurchaseOrder_clientId_idx" RENAME TO "PurchaseOrder_supplierId_idx";
ALTER INDEX IF EXISTS "SalesOrder_supplierId_idx" RENAME TO "SalesOrder_clientId_idx";

UPDATE "PurchaseOrder"
SET "supplierId" = NULL
WHERE "supplierId" IS NOT NULL;

UPDATE "SalesOrder"
SET "clientId" = NULL
WHERE "clientId" IS NOT NULL;

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;