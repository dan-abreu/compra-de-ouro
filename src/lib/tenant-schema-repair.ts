import { PrismaClient } from "@prisma/client";

import { getTenantContext } from "../tenant/tenant-context.js";

const repairedTenants = new Set<string>();
const tenantRepairInFlight = new Map<string, Promise<void>>();

const getTenantRepairKey = () => {
  const tenantId = getTenantContext()?.tenantId;
  if (!tenantId) {
    throw new Error("TENANT_CONTEXT_MISSING");
  }

  return tenantId;
};

const runRepairSql = async (prisma: PrismaClient) => {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "Vault"
    ADD COLUMN IF NOT EXISTS "openGoldAcquisitionCostUsd" DECIMAL(18, 4)
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'Vault'
      ) THEN
        EXECUTE '
          UPDATE "Vault"
          SET "openGoldAcquisitionCostUsd" = 0
          WHERE "openGoldAcquisitionCostUsd" IS NULL
        ';

        EXECUTE '
          ALTER TABLE "Vault"
          ALTER COLUMN "openGoldAcquisitionCostUsd" SET NOT NULL
        ';

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'Vault' AND column_name = 'openGoldAcquisitionCostInBase'
        ) THEN
          EXECUTE '
            UPDATE "Vault"
            SET "openGoldAcquisitionCostInBase" = COALESCE("openGoldAcquisitionCostInBase", "openGoldAcquisitionCostUsd", 0)
            WHERE "openGoldAcquisitionCostInBase" IS NULL
          ';

          EXECUTE '
            ALTER TABLE "Vault"
            ALTER COLUMN "openGoldAcquisitionCostInBase" SET DEFAULT 0
          ';
        END IF;
      END IF;
    END
    $$
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "SalesOrder"
    ADD COLUMN IF NOT EXISTS "averageAcquisitionCostUsd" DECIMAL(18, 4)
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'SalesOrder'
      ) THEN
        EXECUTE '
          UPDATE "SalesOrder"
          SET "averageAcquisitionCostUsd" = 0
          WHERE "averageAcquisitionCostUsd" IS NULL
        ';

        EXECUTE '
          ALTER TABLE "SalesOrder"
          ALTER COLUMN "averageAcquisitionCostUsd" SET NOT NULL
        ';
      END IF;
    END
    $$
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "SalesOrder"
    ADD COLUMN IF NOT EXISTS "realizedProfitUsd" DECIMAL(18, 4)
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'SalesOrder'
      ) THEN
        EXECUTE '
          UPDATE "SalesOrder"
          SET "realizedProfitUsd" = 0
          WHERE "realizedProfitUsd" IS NULL
        ';

        EXECUTE '
          ALTER TABLE "SalesOrder"
          ALTER COLUMN "realizedProfitUsd" SET NOT NULL
        ';
      END IF;
    END
    $$
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "DailyRate"
    ADD COLUMN IF NOT EXISTS "goldPricePerGramUsd" DECIMAL(18, 4)
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "DailyRate"
    ADD COLUMN IF NOT EXISTS "usdToSrdRate" DECIMAL(18, 4)
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "DailyRate"
    ADD COLUMN IF NOT EXISTS "eurToUsdRate" DECIMAL(18, 4)
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'DailyRate' AND column_name = 'goldPricePerGram'
      ) THEN
        EXECUTE '
          UPDATE "DailyRate"
          SET "goldPricePerGramUsd" = "goldPricePerGram"
          WHERE "goldPricePerGramUsd" IS NULL
        ';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'DailyRate' AND column_name = 'usdToSrd'
      ) THEN
        EXECUTE '
          UPDATE "DailyRate"
          SET "usdToSrdRate" = "usdToSrd"
          WHERE "usdToSrdRate" IS NULL
        ';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'DailyRate' AND column_name = 'eurToUsd'
      ) THEN
        EXECUTE '
          UPDATE "DailyRate"
          SET "eurToUsdRate" = "eurToUsd"
          WHERE "eurToUsdRate" IS NULL
        ';
      END IF;
    END
    $$
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'DailyRate'
      ) THEN
        EXECUTE '
          UPDATE "DailyRate"
          SET "goldPricePerGramUsd" = 0
          WHERE "goldPricePerGramUsd" IS NULL
        ';

        EXECUTE '
          UPDATE "DailyRate"
          SET "usdToSrdRate" = 0
          WHERE "usdToSrdRate" IS NULL
        ';

        EXECUTE '
          UPDATE "DailyRate"
          SET "eurToUsdRate" = 0
          WHERE "eurToUsdRate" IS NULL
        ';

        EXECUTE '
          ALTER TABLE "DailyRate"
          ALTER COLUMN "goldPricePerGramUsd" SET NOT NULL
        ';

        EXECUTE '
          ALTER TABLE "DailyRate"
          ALTER COLUMN "usdToSrdRate" SET NOT NULL
        ';

        EXECUTE '
          ALTER TABLE "DailyRate"
          ALTER COLUMN "eurToUsdRate" SET NOT NULL
        ';
      END IF;
    END
    $$
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "LoanBookEntry"
    ADD COLUMN IF NOT EXISTS "principalInputCurrency" VARCHAR(16)
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE IF EXISTS "LoanBookEntry"
    ADD COLUMN IF NOT EXISTS "principalInputAmount" DECIMAL(18, 4)
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'LoanBookEntry'
      ) THEN
        EXECUTE '
          UPDATE "LoanBookEntry"
          SET "principalInputCurrency" = ''USD''
          WHERE "principalInputCurrency" IS NULL OR trim("principalInputCurrency") = ''''
        ';

        EXECUTE '
          UPDATE "LoanBookEntry"
          SET "principalInputAmount" = ABS("principalAmountUsd")
          WHERE "principalInputAmount" IS NULL
        ';

        EXECUTE '
          ALTER TABLE "LoanBookEntry"
          ALTER COLUMN "principalInputCurrency" SET DEFAULT ''USD''
        ';

        EXECUTE '
          ALTER TABLE "LoanBookEntry"
          ALTER COLUMN "principalInputCurrency" SET NOT NULL
        ';

        EXECUTE '
          ALTER TABLE "LoanBookEntry"
          ALTER COLUMN "principalInputAmount" SET DEFAULT 0
        ';

        EXECUTE '
          ALTER TABLE "LoanBookEntry"
          ALTER COLUMN "principalInputAmount" SET NOT NULL
        ';
      END IF;
    END
    $$
  `);
};

export const ensureTenantSchemaForTrading = async (prisma: PrismaClient) => {
  const tenantKey = getTenantRepairKey();

  if (repairedTenants.has(tenantKey)) {
    return;
  }

  const running = tenantRepairInFlight.get(tenantKey);
  if (running) {
    await running;
    return;
  }

  const repairPromise = runRepairSql(prisma)
    .then(() => {
      repairedTenants.add(tenantKey);
    })
    .finally(() => {
      tenantRepairInFlight.delete(tenantKey);
    });

  tenantRepairInFlight.set(tenantKey, repairPromise);
  await repairPromise;
};
