import { GoldState, LoanBookStatus, OpexStatus, OrderStatus } from "@prisma/client";
import { Decimal } from "decimal.js";
import { Router } from "express";

import { D, q4 } from "../lib/decimal.js";
import { prisma } from "../prisma.js";

const router = Router();

const r4 = (n: Decimal.Value | null | undefined) => q4(n ?? 0).toFixed(4);

router.get("/", async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const [
      vault,
      ledgerAgg,
      todayPurchases,
      todaySales,
      lifetimePurchases,
      lifetimeSales,
      finalizedPurchaseIds,
      finalizedSaleIds,
      loanBooks,
      opexToday
    ] = await Promise.all([
      prisma.vault.findUnique({ where: { code: "MAIN" } }),

      // Gold inventory by category and entry type
      prisma.vaultLedger.groupBy({
        by: ["goldState", "entryType"],
        _sum: { physicalWeight: true, totalAmountUsd: true }
      }),

      // Today purchase aggregate
      prisma.purchaseOrder.aggregate({
        where: { status: OrderStatus.FINALIZED, createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { acquisitionCostUsd: true },
        _count: { id: true }
      }),

      // Today sales aggregate
      prisma.salesOrder.aggregate({
        where: { status: OrderStatus.FINALIZED, createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { realizedProfitUsd: true, negotiatedTotalUsd: true },
        _count: { id: true }
      }),

      // Lifetime purchase aggregate
      prisma.purchaseOrder.aggregate({
        where: { status: OrderStatus.FINALIZED },
        _sum: { acquisitionCostUsd: true },
        _count: { id: true }
      }),

      // Lifetime sales aggregate
      prisma.salesOrder.aggregate({
        where: { status: OrderStatus.FINALIZED },
        _sum: { realizedProfitUsd: true, negotiatedTotalUsd: true },
        _count: { id: true }
      }),

      // IDs for finalized orders — for currency flow aggregation
      prisma.purchaseOrder
        .findMany({ where: { status: OrderStatus.FINALIZED }, select: { id: true } })
        .then((rows) => rows.map((r) => r.id)),

      prisma.salesOrder
        .findMany({ where: { status: OrderStatus.FINALIZED }, select: { id: true } })
        .then((rows) => rows.map((r) => r.id)),

      prisma.loanBookEntry.findMany({
        where: { status: { in: [LoanBookStatus.OPEN, LoanBookStatus.SETTLED] } },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
      }),

      prisma.opexEntry.findMany({
        where: {
          status: OpexStatus.ACTIVE,
          occurredAt: { gte: todayStart, lte: todayEnd }
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
      })
    ]);

    // ── Currency flows from PaymentSplit ───────────────────────────────────
    const [purchaseSplitAgg, saleSplitAgg] = await Promise.all([
      prisma.paymentSplit.groupBy({
        by: ["currency"],
        where: {
          orderType: "PURCHASE",
          ...(finalizedPurchaseIds.length > 0 ? { purchaseOrderId: { in: finalizedPurchaseIds } } : { purchaseOrderId: "NONE" })
        },
        _sum: { amount: true, convertedValueUsd: true }
      }),
      prisma.paymentSplit.groupBy({
        by: ["currency"],
        where: {
          orderType: "SALE",
          ...(finalizedSaleIds.length > 0 ? { salesOrderId: { in: finalizedSaleIds } } : { salesOrderId: "NONE" })
        },
        _sum: { amount: true, convertedValueUsd: true }
      })
    ]);

    // ── Build currency flows map ───────────────────────────────────────────
    const CURRENCIES = ["USD", "EUR", "SRD"] as const;
    const currencyFlows: Record<string, unknown> = {};

    for (const cur of CURRENCIES) {
      const pRow = purchaseSplitAgg.find((r) => r.currency === cur);
      const sRow = saleSplitAgg.find((r) => r.currency === cur);
      const paidOut = D(pRow?._sum?.amount ?? 0);
      const receivedIn = D(sRow?._sum?.amount ?? 0);
      currencyFlows[cur] = {
        currency: cur,
        paidOutInPurchases: r4(paidOut),
        receivedFromSales: r4(receivedIn),
        netFlow: r4(receivedIn.minus(paidOut))
      };
    }

    // ── Build gold-by-category ─────────────────────────────────────────────
    const CATEGORIES: Array<{ state: GoldState; label: string }> = [
      { state: GoldState.BURNED, label: "Ouro Queimado" },
      { state: GoldState.MELTED, label: "Ouro Fundido" }
    ];

    const goldByCategory = CATEGORIES.map(({ state, label }) => {
      const inRow  = ledgerAgg.find((r) => r.goldState === state && r.entryType === "PURCHASE_IN");
      const outRow = ledgerAgg.find((r) => r.goldState === state && r.entryType === "SALE_OUT");

      const purchasedWeight = D(inRow?._sum?.physicalWeight ?? 0);
      const soldWeight = D(outRow?._sum?.physicalWeight ?? 0);
      const netWeight = purchasedWeight.minus(soldWeight);
      const costBasisUsd = D(inRow?._sum?.totalAmountUsd ?? 0);
      const soldCostBasis = D(outRow?._sum?.totalAmountUsd ?? 0);
      const netCostBasisUsd = costBasisUsd.minus(soldCostBasis);
      const avgCostPerGram = purchasedWeight.gt(0) ? costBasisUsd.div(purchasedWeight) : D(0);

      return {
        category:           state as string,
        label,
        netWeightGrams: r4(netWeight),
        purchasedWeightGrams: r4(purchasedWeight),
        costBasisUsd: r4(netCostBasisUsd),
        avgCostPerGramUsd: r4(avgCostPerGram)
      };
    });

    // ── Build P&L ─────────────────────────────────────────────────────────
    const buildPnl = (
      sales: typeof todaySales,
      purchases: typeof todayPurchases
    ) => ({
      tradingProfitUsd: r4(sales._sum?.realizedProfitUsd ?? 0),
      grossRevenueUsd: r4(sales._sum?.negotiatedTotalUsd ?? 0),
      totalPurchaseCostUsd: r4(purchases._sum?.acquisitionCostUsd ?? 0),
      saleCount: sales._count.id,
      purchaseCount: purchases._count.id
    });

    return res.json({
      generatedAt: now.toISOString(),
      vault: vault
        ? {
            balanceUsd:                  r4(vault.balanceUsd),
            balanceEur:                  r4(vault.balanceEur),
            balanceSrd:                  r4(vault.balanceSrd),
            balanceGoldGrams:            r4(vault.balanceGoldGrams),
            openGoldGrams:               r4(vault.openGoldGrams),
            openGoldAcquisitionCostUsd:  r4(vault.openGoldAcquisitionCostUsd)
          }
        : null,
      goldByCategory,
      pnlToday:    buildPnl(todaySales,    todayPurchases),
      pnlLifetime: buildPnl(lifetimeSales, lifetimePurchases),
      currencyFlows,
      loanBooks: loanBooks.map((entry) => ({
        id: entry.id,
        counterpartyName: entry.counterpartyName,
        runningBalanceUsd: r4(entry.runningBalanceUsd),
        frontMoneyUsd: r4(entry.frontMoneyUsd),
        goldOwedGrams: r4(entry.goldOwedGrams),
        status: entry.status,
        updatedAt: entry.updatedAt.toISOString()
      })),
      opexToday: opexToday.map((item) => ({
        id: item.id,
        category: item.category,
        description: item.description,
        amountUsd: r4(item.amountUsd),
        occurredAt: item.occurredAt.toISOString().slice(0, 10)
      }))
    });
  } catch (error) {
    console.error("[treasury] error:", error);
    return res.status(500).json({ message: "Internal server error", code: "INTERNAL_SERVER_ERROR" });
  }
});

export { router as treasuryRouter };
