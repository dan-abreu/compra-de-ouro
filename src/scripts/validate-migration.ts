import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { D } from "../lib/decimal.js";

const prisma = new PrismaClient();

type NullCountRow = {
  purchasePhysicalNull: bigint;
  purchasePurityNull: bigint;
  purchaseGoldStateNull: bigint;
  salesPhysicalNull: bigint;
  salesPurityNull: bigint;
  salesGoldStateNull: bigint;
};

type PurchaseMathRow = {
  checkedRows: bigint;
  mismatchRows: bigint;
  maxAbsDiff: string;
};

type PurchaseMismatchSampleRow = {
  id: string;
  createdAt: Date;
  physicalWeight: string;
  lockedGoldPricePerGramUsd: string;
  totalAmountUsd: string;
  expectedTotalUsd: string;
  absDiff: string;
};

type SalesMathRow = {
  checkedRows: bigint;
  mismatchRows: bigint;
  maxAbsDiff: string;
};

type SalesMismatchSampleRow = {
  id: string;
  createdAt: Date;
  physicalWeight: string;
  purityPercentage: string;
  goldState: string;
  absDiff: string;
};

type VaultLedgerRow = {
  vaultCode: string;
  purchaseInGold: string;
  saleOutGold: string;
  adjustmentGold: string;
  netLedgerGold: string;
  currentVaultBalanceGold: string;
  absDiff: string;
};

const DECIMAL_TOLERANCE = "0.0001";
const SAMPLE_LIMIT = 10;

const fmtBigInt = (value: bigint) => value.toString();

const quote = (identifier: string) => `"${identifier.replace(/"/g, "")}"`;

const getColumns = async (tableName: string): Promise<Set<string>> => {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName};
  `;

  return new Set(rows.map((r) => r.column_name));
};

const pickColumn = (columns: Set<string>, options: string[]): string | null => {
  for (const option of options) {
    if (columns.has(option)) {
      return option;
    }
  }

  return null;
};

async function run() {
  console.log("\n=== MIGRATION SANITY CHECK REPORT ===");
  console.log(`Tolerance: ${DECIMAL_TOLERANCE}`);

  const purchaseColumns = await getColumns("PurchaseOrder");
  const salesColumns = await getColumns("SalesOrder");
  const vaultColumns = await getColumns("Vault");
  const ledgerColumns = await getColumns("VaultLedger");

  const pPhysical = pickColumn(purchaseColumns, ["physical_weight", "physicalWeight"]);
  const pPurity = pickColumn(purchaseColumns, ["purity_percentage", "purityPercentage"]);
  const pGoldState = pickColumn(purchaseColumns, ["gold_state", "goldState"]);
  const pTotal = pickColumn(purchaseColumns, ["totalAmountUsd"]);
  const pPrice = pickColumn(purchaseColumns, ["lockedGoldPricePerGramUsd"]);

  const sPhysical = pickColumn(salesColumns, ["physical_weight", "physicalWeight"]);
  const sPurity = pickColumn(salesColumns, ["purity_percentage", "purityPercentage"]);
  const sGoldState = pickColumn(salesColumns, ["gold_state", "goldState"]);

  const vCode = pickColumn(vaultColumns, ["code"]);
  const vBalanceGold = pickColumn(vaultColumns, ["balanceGoldGrams", "balance_gold_grams"]);

  const lVaultCode = pickColumn(ledgerColumns, ["vault_code", "vaultCode"]);
  const lEntryType = pickColumn(ledgerColumns, ["entry_type", "entryType"]);
  const lPhysical = pickColumn(ledgerColumns, ["physical_weight", "physicalWeight"]);

  const required = [
    ["PurchaseOrder", "physicalWeight/physical_weight", pPhysical],
    ["PurchaseOrder", "purityPercentage/purity_percentage", pPurity],
    ["PurchaseOrder", "goldState/gold_state", pGoldState],
    ["PurchaseOrder", "totalAmountUsd", pTotal],
    ["PurchaseOrder", "lockedGoldPricePerGramUsd", pPrice],
    ["SalesOrder", "physicalWeight/physical_weight", sPhysical],
    ["SalesOrder", "purityPercentage/purity_percentage", sPurity],
    ["SalesOrder", "goldState/gold_state", sGoldState],
    ["Vault", "code", vCode],
    ["Vault", "balanceGoldGrams", vBalanceGold],
    ["VaultLedger", "vaultCode/vault_code", lVaultCode],
    ["VaultLedger", "entryType/entry_type", lEntryType],
    ["VaultLedger", "physicalWeight/physical_weight", lPhysical]
  ] as const;

  const missing = required.filter(([, , picked]) => !picked);
  if (missing.length > 0) {
    console.log("\n[PRECHECK] Missing required post-migration columns:");
    for (const [tableName, expected] of missing) {
      console.log(`- ${tableName}: expected ${expected}`);
    }
    console.log("- Result: FAIL (schema appears not fully migrated for this DATABASE_URL)");
    process.exitCode = 1;
    return;
  }

  const pPhysicalCol = pPhysical as string;
  const pPurityCol = pPurity as string;
  const pGoldStateCol = pGoldState as string;
  const pTotalCol = pTotal as string;
  const pPriceCol = pPrice as string;

  const sPhysicalCol = sPhysical as string;
  const sPurityCol = sPurity as string;
  const sGoldStateCol = sGoldState as string;

  const vCodeCol = vCode as string;
  const vBalanceGoldCol = vBalanceGold as string;

  const lVaultCodeCol = lVaultCode as string;
  const lEntryTypeCol = lEntryType as string;
  const lPhysicalCol = lPhysical as string;

  const nullCountsSql = `
    SELECT
      COUNT(*) FILTER (WHERE ${quote(pPhysicalCol)} IS NULL) AS "purchasePhysicalNull",
      COUNT(*) FILTER (WHERE ${quote(pPurityCol)} IS NULL) AS "purchasePurityNull",
      COUNT(*) FILTER (WHERE ${quote(pGoldStateCol)} IS NULL) AS "purchaseGoldStateNull",
      (SELECT COUNT(*) FROM "SalesOrder" WHERE ${quote(sPhysicalCol)} IS NULL) AS "salesPhysicalNull",
      (SELECT COUNT(*) FROM "SalesOrder" WHERE ${quote(sPurityCol)} IS NULL) AS "salesPurityNull",
      (SELECT COUNT(*) FROM "SalesOrder" WHERE ${quote(sGoldStateCol)} IS NULL) AS "salesGoldStateNull"
    FROM "PurchaseOrder";
  `;
  const nullCounts = await prisma.$queryRawUnsafe<NullCountRow[]>(nullCountsSql);

  const nullRow = nullCounts[0];
  const nullFailures = [
    nullRow.purchasePhysicalNull,
    nullRow.purchasePurityNull,
    nullRow.purchaseGoldStateNull,
    nullRow.salesPhysicalNull,
    nullRow.salesPurityNull,
    nullRow.salesGoldStateNull
  ].some((v) => v > 0n);

  console.log("\n[CHECK 1] Null Counts (PurchaseOrder + SalesOrder)");
  console.log(`- PurchaseOrder.physical_weight NULLs: ${fmtBigInt(nullRow.purchasePhysicalNull)}`);
  console.log(`- PurchaseOrder.purity_percentage NULLs: ${fmtBigInt(nullRow.purchasePurityNull)}`);
  console.log(`- PurchaseOrder.gold_state NULLs: ${fmtBigInt(nullRow.purchaseGoldStateNull)}`);
  console.log(`- SalesOrder.physical_weight NULLs: ${fmtBigInt(nullRow.salesPhysicalNull)}`);
  console.log(`- SalesOrder.purity_percentage NULLs: ${fmtBigInt(nullRow.salesPurityNull)}`);
  console.log(`- SalesOrder.gold_state NULLs: ${fmtBigInt(nullRow.salesGoldStateNull)}`);
  console.log(`- Result: ${nullFailures ? "FAIL" : "PASS"}`);

  const purchaseMathSql = `
    WITH calc AS (
      SELECT
        "id",
        ABS(${quote(pTotalCol)} - (${quote(pPhysicalCol)} * ${quote(pPriceCol)})) AS abs_diff
      FROM "PurchaseOrder"
    )
    SELECT
      COUNT(*)::bigint AS "checkedRows",
      COUNT(*) FILTER (WHERE abs_diff > ${DECIMAL_TOLERANCE}::numeric)::bigint AS "mismatchRows",
      COALESCE(MAX(abs_diff), 0)::text AS "maxAbsDiff"
    FROM calc;
  `;
  const purchaseMath = await prisma.$queryRawUnsafe<PurchaseMathRow[]>(purchaseMathSql);

  const purchaseRow = purchaseMath[0];
  const purchaseFail = purchaseRow.mismatchRows > 0n;

  console.log("\n[CHECK 2] Purchase Math Integrity (totalAmountUsd == physical_weight * lockedGoldPricePerGramUsd)");
  console.log(`- Rows checked: ${fmtBigInt(purchaseRow.checkedRows)}`);
  console.log(`- Mismatch rows: ${fmtBigInt(purchaseRow.mismatchRows)}`);
  console.log(`- Max abs diff: ${purchaseRow.maxAbsDiff}`);
  console.log(`- Result: ${purchaseFail ? "FAIL" : "PASS"}`);

  if (purchaseFail) {
    const purchaseSamplesSql = `
      SELECT
        "id",
        "createdAt",
        ${quote(pPhysicalCol)}::text AS "physicalWeight",
        ${quote(pPriceCol)}::text AS "lockedGoldPricePerGramUsd",
        ${quote(pTotalCol)}::text AS "totalAmountUsd",
        (${quote(pPhysicalCol)} * ${quote(pPriceCol)})::text AS "expectedTotalUsd",
        ABS(${quote(pTotalCol)} - (${quote(pPhysicalCol)} * ${quote(pPriceCol)}))::text AS "absDiff"
      FROM "PurchaseOrder"
      WHERE ABS(${quote(pTotalCol)} - (${quote(pPhysicalCol)} * ${quote(pPriceCol)})) > ${DECIMAL_TOLERANCE}::numeric
      ORDER BY "createdAt" DESC
      LIMIT ${SAMPLE_LIMIT};
    `;
    const purchaseSamples = await prisma.$queryRawUnsafe<PurchaseMismatchSampleRow[]>(purchaseSamplesSql);

    console.log(`- Sample mismatches (${purchaseSamples.length}):`);
    for (const row of purchaseSamples) {
      console.log(
        `  • ${row.id} | ${row.createdAt.toISOString()} | total=${row.totalAmountUsd} expected=${row.expectedTotalUsd} diff=${row.absDiff}`
      );
    }
  }

  const salesMathSql = `
    WITH validity AS (
      SELECT
        "id",
        "createdAt",
        ABS(${quote(sPurityCol)} - LEAST(GREATEST(${quote(sPurityCol)}, 0), 100)) AS abs_diff
      FROM "SalesOrder"
      WHERE ${quote(sPhysicalCol)} > 0
    )
    SELECT
      COUNT(*)::bigint AS "checkedRows",
      COUNT(*) FILTER (WHERE abs_diff > ${DECIMAL_TOLERANCE}::numeric)::bigint AS "mismatchRows",
      COALESCE(MAX(abs_diff), 0)::text AS "maxAbsDiff"
    FROM validity;
  `;
  const salesMath = await prisma.$queryRawUnsafe<SalesMathRow[]>(salesMathSql);

  const salesRow = salesMath[0];
  const salesFail = salesRow.mismatchRows > 0n;

  console.log("\n[CHECK 3] Sales Physical Integrity (purity between 0 and 100 for orders with physical weight)");
  console.log(`- Rows checked: ${fmtBigInt(salesRow.checkedRows)}`);
  console.log(`- Mismatch rows: ${fmtBigInt(salesRow.mismatchRows)}`);
  console.log(`- Max abs diff: ${salesRow.maxAbsDiff}`);
  console.log(`- Result: ${salesFail ? "FAIL" : "PASS"}`);

  if (salesFail) {
    const salesSamplesSql = `
      SELECT
        "id",
        "createdAt",
        ${quote(sPhysicalCol)}::text AS "physicalWeight",
        ${quote(sPurityCol)}::text AS "purityPercentage",
        ${quote(sGoldStateCol)}::text AS "goldState",
        ABS(${quote(sPurityCol)} - LEAST(GREATEST(${quote(sPurityCol)}, 0), 100))::text AS "absDiff"
      FROM "SalesOrder"
      WHERE ${quote(sPhysicalCol)} > 0
        AND ABS(${quote(sPurityCol)} - LEAST(GREATEST(${quote(sPurityCol)}, 0), 100)) > ${DECIMAL_TOLERANCE}::numeric
      ORDER BY "createdAt" DESC
      LIMIT ${SAMPLE_LIMIT};
    `;
    const salesSamples = await prisma.$queryRawUnsafe<SalesMismatchSampleRow[]>(salesSamplesSql);

    console.log(`- Sample mismatches (${salesSamples.length}):`);
    for (const row of salesSamples) {
      console.log(
        `  • ${row.id} | ${row.createdAt.toISOString()} | physical=${row.physicalWeight} purity=${row.purityPercentage} state=${row.goldState} diff=${row.absDiff}`
      );
    }
  }

  const vaultSql = `
    WITH ledger AS (
      SELECT
        ${quote(lVaultCodeCol)} AS vault_code,
        COALESCE(SUM(CASE WHEN ${quote(lEntryTypeCol)}::text = 'PURCHASE_IN' THEN ${quote(lPhysicalCol)} ELSE 0 END), 0) AS purchase_in_gold,
        COALESCE(SUM(CASE WHEN ${quote(lEntryTypeCol)}::text = 'SALE_OUT' THEN ${quote(lPhysicalCol)} ELSE 0 END), 0) AS sale_out_gold,
        COALESCE(SUM(CASE WHEN ${quote(lEntryTypeCol)}::text = 'ADJUSTMENT' THEN ${quote(lPhysicalCol)} ELSE 0 END), 0) AS adjustment_gold,
        COALESCE(SUM(
          CASE
            WHEN ${quote(lEntryTypeCol)}::text = 'PURCHASE_IN' THEN ${quote(lPhysicalCol)}
            WHEN ${quote(lEntryTypeCol)}::text = 'SALE_OUT' THEN -${quote(lPhysicalCol)}
            ELSE ${quote(lPhysicalCol)}
          END
        ), 0) AS net_ledger_gold
      FROM "VaultLedger"
      GROUP BY ${quote(lVaultCodeCol)}
    )
    SELECT
      v.${quote(vCodeCol)} AS "vaultCode",
      COALESCE(l.purchase_in_gold, 0)::text AS "purchaseInGold",
      COALESCE(l.sale_out_gold, 0)::text AS "saleOutGold",
      COALESCE(l.adjustment_gold, 0)::text AS "adjustmentGold",
      COALESCE(l.net_ledger_gold, 0)::text AS "netLedgerGold",
      v.${quote(vBalanceGoldCol)}::text AS "currentVaultBalanceGold",
      ABS(v.${quote(vBalanceGoldCol)} - COALESCE(l.net_ledger_gold, 0))::text AS "absDiff"
    FROM "Vault" v
    LEFT JOIN ledger l ON l.vault_code = v.${quote(vCodeCol)}
    ORDER BY v.${quote(vCodeCol)};
  `;
  const vaultLedgerRows = await prisma.$queryRawUnsafe<VaultLedgerRow[]>(vaultSql);

  const vaultFail = vaultLedgerRows.some((row) => D(row.absDiff).gt(D(DECIMAL_TOLERANCE)));

  console.log("\n[CHECK 4] VaultLedger Reconciliation (ledger net vs current Vault.balanceGoldGrams)");
  if (vaultLedgerRows.length === 0) {
    console.log("- No vault rows found.");
    console.log("- Result: FAIL");
  } else {
    for (const row of vaultLedgerRows) {
      console.log(`- Vault ${row.vaultCode}`);
      console.log(`  purchase_in_gold: ${row.purchaseInGold}`);
      console.log(`  sale_out_gold: ${row.saleOutGold}`);
      console.log(`  adjustment_gold: ${row.adjustmentGold}`);
      console.log(`  net_ledger_gold: ${row.netLedgerGold}`);
      console.log(`  current_balance_gold: ${row.currentVaultBalanceGold}`);
      console.log(`  abs_diff: ${row.absDiff}`);
    }
    console.log(`- Result: ${vaultFail ? "FAIL" : "PASS"}`);
  }

  const overallFail = nullFailures || purchaseFail || salesFail || vaultFail || vaultLedgerRows.length === 0;
  console.log("\n=== OVERALL ===");
  console.log(overallFail ? "INTEGRITY CHECK FAILED" : "INTEGRITY CHECK PASSED");
}

run()
  .catch((error) => {
    console.error("\nValidation failed with runtime error:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
