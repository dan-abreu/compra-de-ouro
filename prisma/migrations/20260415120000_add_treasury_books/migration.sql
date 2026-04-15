-- Create enums
CREATE TYPE "LoanBookStatus" AS ENUM ('OPEN', 'SETTLED', 'CANCELED');
CREATE TYPE "GoldTransitStatus" AS ENUM ('IN_TRANSIT', 'SETTLED', 'CANCELED');
CREATE TYPE "OpexStatus" AS ENUM ('ACTIVE', 'VOID');

-- Create loan book entries
CREATE TABLE "LoanBookEntry" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "counterpartyName" VARCHAR(180) NOT NULL,
  "runningBalanceUsd" DECIMAL(18,4) NOT NULL,
  "frontMoneyUsd" DECIMAL(18,4) NOT NULL,
  "goldOwedGrams" DECIMAL(18,4) NOT NULL,
  "status" "LoanBookStatus" NOT NULL DEFAULT 'OPEN',
  "notes" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoanBookEntry_pkey" PRIMARY KEY ("id")
);

-- Create gold transit shipments
CREATE TABLE "GoldTransitShipment" (
  "id" TEXT NOT NULL,
  "destination" VARCHAR(180) NOT NULL,
  "physicalWeight" DECIMAL(18,4) NOT NULL,
  "dispatchDate" DATE NOT NULL,
  "expectedSettlementDate" DATE NOT NULL,
  "settledAt" TIMESTAMP(3),
  "status" "GoldTransitStatus" NOT NULL DEFAULT 'IN_TRANSIT',
  "notes" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoldTransitShipment_pkey" PRIMARY KEY ("id")
);

-- Create opex entries
CREATE TABLE "OpexEntry" (
  "id" TEXT NOT NULL,
  "category" VARCHAR(120) NOT NULL,
  "description" VARCHAR(255) NOT NULL,
  "amountUsd" DECIMAL(18,4) NOT NULL,
  "occurredAt" DATE NOT NULL,
  "status" "OpexStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpexEntry_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "LoanBookEntry_clientId_idx" ON "LoanBookEntry"("clientId");
CREATE INDEX "LoanBookEntry_status_idx" ON "LoanBookEntry"("status");
CREATE INDEX "LoanBookEntry_createdAt_idx" ON "LoanBookEntry"("createdAt");

CREATE INDEX "GoldTransitShipment_status_idx" ON "GoldTransitShipment"("status");
CREATE INDEX "GoldTransitShipment_dispatchDate_idx" ON "GoldTransitShipment"("dispatchDate");

CREATE INDEX "OpexEntry_status_idx" ON "OpexEntry"("status");
CREATE INDEX "OpexEntry_occurredAt_idx" ON "OpexEntry"("occurredAt");

-- Foreign key
ALTER TABLE "LoanBookEntry"
ADD CONSTRAINT "LoanBookEntry_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
