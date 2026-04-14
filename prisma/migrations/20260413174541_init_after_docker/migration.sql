-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('SRD', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "PaymentOrderType" AS ENUM ('PURCHASE', 'SALE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(180) NOT NULL,
    "documentId" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(40),
    "address" VARCHAR(255),
    "goldOrigin" VARCHAR(180),
    "kycDocumentUrl" VARCHAR(500),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "companyName" VARCHAR(180) NOT NULL,
    "documentId" VARCHAR(80) NOT NULL,
    "contactName" VARCHAR(120),
    "phone" VARCHAR(40),
    "address" VARCHAR(255),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreConfig" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRate" (
    "id" TEXT NOT NULL,
    "rateDate" DATE NOT NULL,
    "baseCurrency" "Currency" NOT NULL DEFAULT 'USD',
    "goldPricePerGramInBase" DECIMAL(18,4) NOT NULL,
    "srdToBaseRate" DECIMAL(18,4) NOT NULL,
    "eurToBaseRate" DECIMAL(18,4) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vault" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL DEFAULT 'MAIN',
    "baseCurrency" "Currency" NOT NULL DEFAULT 'USD',
    "balanceGoldGrams" DECIMAL(18,4) NOT NULL,
    "balanceSrd" DECIMAL(18,4) NOT NULL,
    "balanceUsd" DECIMAL(18,4) NOT NULL,
    "balanceEur" DECIMAL(18,4) NOT NULL,
    "openGoldGrams" DECIMAL(18,4) NOT NULL,
    "openGoldAcquisitionCostInBase" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "clientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceledAt" TIMESTAMP(3),
    "canceledById" TEXT,
    "cancelReason" VARCHAR(255),
    "grossWeight" DECIMAL(18,4) NOT NULL,
    "netWeight" DECIMAL(18,4) NOT NULL,
    "purityPercentage" DECIMAL(18,4) NOT NULL,
    "fineGoldWeight" DECIMAL(18,4) NOT NULL,
    "baseCurrency" "Currency" NOT NULL DEFAULT 'USD',
    "lockedGoldPricePerGramInBase" DECIMAL(18,4) NOT NULL,
    "lockedSrdToBaseRate" DECIMAL(18,4) NOT NULL,
    "lockedEurToBaseRate" DECIMAL(18,4) NOT NULL,
    "totalAmountInBaseCurrency" DECIMAL(18,4) NOT NULL,
    "acquisitionCostInBaseCurrency" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceledAt" TIMESTAMP(3),
    "canceledById" TEXT,
    "cancelReason" VARCHAR(255),
    "baseCurrency" "Currency" NOT NULL DEFAULT 'USD',
    "fineGoldWeightSold" DECIMAL(18,4) NOT NULL,
    "negotiatedTotalInBaseCurrency" DECIMAL(18,4) NOT NULL,
    "lockedGoldPricePerGramInBase" DECIMAL(18,4) NOT NULL,
    "lockedSrdToBaseRate" DECIMAL(18,4) NOT NULL,
    "lockedEurToBaseRate" DECIMAL(18,4) NOT NULL,
    "averageAcquisitionCostInBaseCurrency" DECIMAL(18,4) NOT NULL,
    "realizedProfitInBaseCurrency" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSplit" (
    "id" TEXT NOT NULL,
    "orderType" "PaymentOrderType" NOT NULL,
    "purchaseOrderId" TEXT,
    "salesOrderId" TEXT,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "convertedValueInBaseCurrency" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSplit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Client_fullName_idx" ON "Client"("fullName");

-- CreateIndex
CREATE INDEX "Client_documentId_idx" ON "Client"("documentId");

-- CreateIndex
CREATE INDEX "Supplier_companyName_idx" ON "Supplier"("companyName");

-- CreateIndex
CREATE INDEX "Supplier_documentId_idx" ON "Supplier"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreConfig_key_key" ON "StoreConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRate_rateDate_key" ON "DailyRate"("rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "Vault_code_key" ON "Vault"("code");

-- CreateIndex
CREATE INDEX "PurchaseOrder_clientId_idx" ON "PurchaseOrder"("clientId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdById_idx" ON "PurchaseOrder"("createdById");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdAt_idx" ON "PurchaseOrder"("createdAt");

-- CreateIndex
CREATE INDEX "SalesOrder_supplierId_idx" ON "SalesOrder"("supplierId");

-- CreateIndex
CREATE INDEX "SalesOrder_createdById_idx" ON "SalesOrder"("createdById");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE INDEX "SalesOrder_createdAt_idx" ON "SalesOrder"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentSplit_orderType_idx" ON "PaymentSplit"("orderType");

-- CreateIndex
CREATE INDEX "PaymentSplit_purchaseOrderId_idx" ON "PaymentSplit"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PaymentSplit_salesOrderId_idx" ON "PaymentSplit"("salesOrderId");

-- CreateIndex
CREATE INDEX "PaymentSplit_currency_idx" ON "PaymentSplit"("currency");

-- AddForeignKey
ALTER TABLE "DailyRate" ADD CONSTRAINT "DailyRate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_canceledById_fkey" FOREIGN KEY ("canceledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_canceledById_fkey" FOREIGN KEY ("canceledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSplit" ADD CONSTRAINT "PaymentSplit_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSplit" ADD CONSTRAINT "PaymentSplit_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
