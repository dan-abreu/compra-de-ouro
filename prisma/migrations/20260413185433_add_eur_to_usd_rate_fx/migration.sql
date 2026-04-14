/*
  Warnings:

  - Added the required column `eurToUsdRate` to the `DailyRate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lockedEurToUsdRate` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lockedEurToUsdRate` to the `SalesOrder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DailyRate" ADD COLUMN     "eurToUsdRate" DECIMAL(18,4) NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "lockedEurToUsdRate" DECIMAL(18,4) NOT NULL;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "lockedEurToUsdRate" DECIMAL(18,4) NOT NULL;
