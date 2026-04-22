ALTER TABLE "LoanBookEntry"
  ADD COLUMN IF NOT EXISTS "principalInputCurrency" VARCHAR(16) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "principalInputAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;

UPDATE "LoanBookEntry"
SET "principalInputAmount" = ABS("principalAmountUsd")
WHERE "principalInputAmount" = 0;
