import {
  CostBaseType,
  GoldState,
  LoanBookStatus,
  LoanDirection,
  MonthlyCostType,
  OpexStatus,
  OrderStatus
} from "@prisma/client";
import { Decimal } from "decimal.js";
import { Router } from "express";

import { D, q4 } from "../lib/decimal.js";
import { isPrismaSchemaOutOfSyncError, mapInfrastructureError } from "../lib/errors.js";
import { ensureTenantSchemaForTrading } from "../lib/tenant-schema-repair.js";
const router = Router();

const r4 = (n: Decimal.Value | null | undefined) => q4(n ?? 0).toFixed(4);

router.get("/", async (req, res) => {
  try {
    const tenantPrisma = req.tenantPrisma;
    if (!tenantPrisma) {
      return res.status(401).json({
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
        fieldErrors: {}
      });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const loadDashboardRows = async () => {
      return Promise.all([
        tenantPrisma.vault.findUnique({ where: { code: "MAIN" } }),

        tenantPrisma.purchaseOrder.groupBy({
          by: ["goldState"],
          where: { status: OrderStatus.FINALIZED },
          _sum: { physicalWeight: true, acquisitionCostUsd: true }
        }),

        tenantPrisma.salesOrder.findMany({
          where: { status: OrderStatus.FINALIZED },
          select: {
            goldState: true,
            physicalWeight: true,
            averageAcquisitionCostUsd: true
          }
        }),

        // Today purchase aggregate
        tenantPrisma.purchaseOrder.aggregate({
          where: { status: OrderStatus.FINALIZED, createdAt: { gte: todayStart, lte: todayEnd } },
          _sum: { acquisitionCostUsd: true },
          _count: { id: true }
        }),

        // Today sales aggregate
        tenantPrisma.salesOrder.aggregate({
          where: { status: OrderStatus.FINALIZED, createdAt: { gte: todayStart, lte: todayEnd } },
          _sum: { realizedProfitUsd: true, negotiatedTotalUsd: true },
          _count: { id: true }
        }),

        // Lifetime purchase aggregate
        tenantPrisma.purchaseOrder.aggregate({
          where: { status: OrderStatus.FINALIZED },
          _sum: { acquisitionCostUsd: true },
          _count: { id: true }
        }),

        // Lifetime sales aggregate
        tenantPrisma.salesOrder.aggregate({
          where: { status: OrderStatus.FINALIZED },
          _sum: { realizedProfitUsd: true, negotiatedTotalUsd: true },
          _count: { id: true }
        }),

        // IDs for finalized orders — for currency flow aggregation
        tenantPrisma.purchaseOrder
          .findMany({ where: { status: OrderStatus.FINALIZED }, select: { id: true } })
          .then((rows) => rows.map((r) => r.id)),

        tenantPrisma.salesOrder
          .findMany({ where: { status: OrderStatus.FINALIZED }, select: { id: true } })
          .then((rows) => rows.map((r) => r.id)),

        tenantPrisma.loanBookEntry.findMany({
          where: { status: { in: [LoanBookStatus.OPEN, LoanBookStatus.SETTLED] } },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
        }),

        tenantPrisma.opexEntry.findMany({
          where: {
            status: OpexStatus.ACTIVE,
            occurredAt: { gte: todayStart, lte: todayEnd }
          },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
        })
      ]);
    };

    let dashboardRows: Awaited<ReturnType<typeof loadDashboardRows>>;

    try {
      dashboardRows = await loadDashboardRows();
    } catch (error) {
      if (!isPrismaSchemaOutOfSyncError(error)) {
        throw error;
      }

      await ensureTenantSchemaForTrading(tenantPrisma);
      dashboardRows = await loadDashboardRows();
    }

    const [
      vault,
      purchaseAggByState,
      finalizedSalesByState,
      todayPurchases,
      todaySales,
      lifetimePurchases,
      lifetimeSales,
      finalizedPurchaseIds,
      finalizedSaleIds,
      loanBooks,
      opexToday
    ] = dashboardRows;

    // ── Currency flows from PaymentSplit ───────────────────────────────────
    const [purchaseSplitAgg, saleSplitAgg] = await Promise.all([
      tenantPrisma.paymentSplit.groupBy({
        by: ["currency"],
        where: {
          orderType: "PURCHASE",
          ...(finalizedPurchaseIds.length > 0 ? { purchaseOrderId: { in: finalizedPurchaseIds } } : { purchaseOrderId: "NONE" })
        },
        _sum: { amount: true, convertedValueUsd: true }
      }),
      tenantPrisma.paymentSplit.groupBy({
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

    const saleAggByState = finalizedSalesByState.reduce<
      Record<string, { soldWeight: Decimal; soldCostBasis: Decimal }>
    >((acc, row) => {
      const key = row.goldState;
      if (!acc[key]) {
        acc[key] = { soldWeight: D(0), soldCostBasis: D(0) };
      }

      const rowWeight = D(row.physicalWeight ?? 0);
      const rowCostBasis = q4(D(row.averageAcquisitionCostUsd ?? 0).mul(rowWeight));

      acc[key].soldWeight = q4(acc[key].soldWeight.add(rowWeight));
      acc[key].soldCostBasis = q4(acc[key].soldCostBasis.add(rowCostBasis));
      return acc;
    }, {});

    const goldByCategory = CATEGORIES.map(({ state, label }) => {
      const purchaseRow = purchaseAggByState.find((r) => r.goldState === state);
      const saleRow = saleAggByState[state];

      const purchasedWeight = D(purchaseRow?._sum?.physicalWeight ?? 0);
      const soldWeight = D(saleRow?.soldWeight ?? 0);
      const netWeight = purchasedWeight.minus(soldWeight);
      const costBasisUsd = D(purchaseRow?._sum?.acquisitionCostUsd ?? 0);
      const soldCostBasis = D(saleRow?.soldCostBasis ?? 0);
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

    const calcMonthlyCostUsd = (entry: (typeof loanBooks)[number]) => {
      if (entry.monthlyCostType === MonthlyCostType.NONE) {
        return D(0);
      }

      if (entry.monthlyCostType === MonthlyCostType.FIXED) {
        return D(entry.monthlyFixedCostUsd ?? 0);
      }

      const rate = D(entry.monthlyRatePercent ?? 0).div(100);
      const base =
        entry.costBaseType === CostBaseType.ORIGINAL_PRINCIPAL
          ? D(entry.principalAmountUsd)
          : D(entry.runningBalanceUsd).abs();
      return q4(base.mul(rate));
    };

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
        direction: entry.direction,
        counterpartyType: entry.counterpartyType,
        counterpartyName: entry.counterpartyName,
        counterpartyDocument: entry.counterpartyDocument,
        principalAmountUsd: r4(entry.principalAmountUsd),
        principalInputCurrency: entry.principalInputCurrency,
        principalInputAmount: r4(entry.principalInputAmount),
        runningBalanceUsd: r4(entry.runningBalanceUsd),
        frontMoneyUsd: r4(entry.frontMoneyUsd),
        goldOwedGrams: r4(entry.goldOwedGrams),
        settlementExpectation: entry.settlementExpectation,
        monthlyCostType: entry.monthlyCostType,
        monthlyRatePercent: r4(entry.monthlyRatePercent),
        monthlyFixedCostUsd: r4(entry.monthlyFixedCostUsd),
        costBaseType: entry.costBaseType,
        monthlyCostUsd: r4(calcMonthlyCostUsd(entry)),
        startDate: entry.startDate.toISOString().slice(0, 10),
        dueDate: entry.dueDate?.toISOString().slice(0, 10) ?? null,
        billingDay: entry.billingDay,
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

    const infraError = mapInfrastructureError(error);
    if (infraError) {
      return res.status(infraError.statusCode).json({
        message: infraError.message,
        code: infraError.code,
        fieldErrors: infraError.fieldErrors ?? {}
      });
    }

    return res.status(500).json({ message: "Internal server error", code: "INTERNAL_SERVER_ERROR" });
  }
});

export { router as treasuryRouter };
