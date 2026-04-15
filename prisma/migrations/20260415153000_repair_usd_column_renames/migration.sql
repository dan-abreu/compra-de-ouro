BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'DailyRate' AND column_name = 'goldPricePerGramInBase'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'DailyRate' AND column_name = 'goldPricePerGramUsd'
  ) THEN
    EXECUTE 'ALTER TABLE "DailyRate" RENAME COLUMN "goldPricePerGramInBase" TO "goldPricePerGramUsd"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'DailyRate' AND column_name = 'srdToBaseRate'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'DailyRate' AND column_name = 'usdToSrdRate'
  ) THEN
    EXECUTE 'ALTER TABLE "DailyRate" RENAME COLUMN "srdToBaseRate" TO "usdToSrdRate"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'DailyRate' AND column_name = 'eurToBaseRate'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'DailyRate' AND column_name = 'eurToUsdRate'
  ) THEN
    EXECUTE 'ALTER TABLE "DailyRate" RENAME COLUMN "eurToBaseRate" TO "eurToUsdRate"';
  END IF;
END $$;

ALTER TABLE "DailyRate" DROP COLUMN IF EXISTS "baseCurrency";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Vault' AND column_name = 'openGoldAcquisitionCostInBase'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Vault' AND column_name = 'openGoldAcquisitionCostUsd'
  ) THEN
    EXECUTE 'ALTER TABLE "Vault" RENAME COLUMN "openGoldAcquisitionCostInBase" TO "openGoldAcquisitionCostUsd"';
  END IF;
END $$;

ALTER TABLE "Vault" DROP COLUMN IF EXISTS "baseCurrency";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'lockedGoldPricePerGramInBase'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'lockedGoldPricePerGramUsd'
  ) THEN
    EXECUTE 'ALTER TABLE "PurchaseOrder" RENAME COLUMN "lockedGoldPricePerGramInBase" TO "lockedGoldPricePerGramUsd"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'lockedSrdToBaseRate'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'lockedUsdToSrdRate'
  ) THEN
    EXECUTE 'ALTER TABLE "PurchaseOrder" RENAME COLUMN "lockedSrdToBaseRate" TO "lockedUsdToSrdRate"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'lockedEurToBaseRate'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'lockedEurToUsdRate'
  ) THEN
    EXECUTE 'ALTER TABLE "PurchaseOrder" RENAME COLUMN "lockedEurToBaseRate" TO "lockedEurToUsdRate"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'totalAmountInBaseCurrency'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'totalAmountUsd'
  ) THEN
    EXECUTE 'ALTER TABLE "PurchaseOrder" RENAME COLUMN "totalAmountInBaseCurrency" TO "totalAmountUsd"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'acquisitionCostInBaseCurrency'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'acquisitionCostUsd'
  ) THEN
    EXECUTE 'ALTER TABLE "PurchaseOrder" RENAME COLUMN "acquisitionCostInBaseCurrency" TO "acquisitionCostUsd"';
  END IF;
END $$;

ALTER TABLE "PurchaseOrder" DROP COLUMN IF EXISTS "baseCurrency";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'negotiatedTotalInBaseCurrency'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'negotiatedTotalUsd'
  ) THEN
    EXECUTE 'ALTER TABLE "SalesOrder" RENAME COLUMN "negotiatedTotalInBaseCurrency" TO "negotiatedTotalUsd"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'lockedGoldPricePerGramInBase'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'lockedGoldPricePerGramUsd'
  ) THEN
    EXECUTE 'ALTER TABLE "SalesOrder" RENAME COLUMN "lockedGoldPricePerGramInBase" TO "lockedGoldPricePerGramUsd"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'lockedSrdToBaseRate'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'lockedUsdToSrdRate'
  ) THEN
    EXECUTE 'ALTER TABLE "SalesOrder" RENAME COLUMN "lockedSrdToBaseRate" TO "lockedUsdToSrdRate"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'lockedEurToBaseRate'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'lockedEurToUsdRate'
  ) THEN
    EXECUTE 'ALTER TABLE "SalesOrder" RENAME COLUMN "lockedEurToBaseRate" TO "lockedEurToUsdRate"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'averageAcquisitionCostInBaseCurrency'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'averageAcquisitionCostUsd'
  ) THEN
    EXECUTE 'ALTER TABLE "SalesOrder" RENAME COLUMN "averageAcquisitionCostInBaseCurrency" TO "averageAcquisitionCostUsd"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'realizedProfitInBaseCurrency'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'SalesOrder' AND column_name = 'realizedProfitUsd'
  ) THEN
    EXECUTE 'ALTER TABLE "SalesOrder" RENAME COLUMN "realizedProfitInBaseCurrency" TO "realizedProfitUsd"';
  END IF;
END $$;

ALTER TABLE "SalesOrder" DROP COLUMN IF EXISTS "baseCurrency";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PaymentSplit' AND column_name = 'convertedValueInBaseCurrency'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PaymentSplit' AND column_name = 'convertedValueUsd'
  ) THEN
    EXECUTE 'ALTER TABLE "PaymentSplit" RENAME COLUMN "convertedValueInBaseCurrency" TO "convertedValueUsd"';
  END IF;
END $$;

COMMIT;