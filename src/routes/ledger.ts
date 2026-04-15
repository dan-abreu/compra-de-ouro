import { OrderStatus } from "@prisma/client";
import { Router } from "express";

import { D, q4 } from "../lib/decimal.js";
import { prisma } from "../prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  const [purchases, sales] = await Promise.all([
    prisma.purchaseOrder.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.salesOrder.findMany({ orderBy: { createdAt: "desc" } })
  ]);

  const purchaseRows = purchases.map((order) => ({
    id: order.id,
    createdAt: order.createdAt,
    kind: "PURCHASE",
    status: order.status,
    physicalWeight: order.physicalWeight,
    costSrd: q4(D(order.acquisitionCostUsd ?? 0).mul(D(order.lockedUsdToSrdRate ?? 0))).toFixed(4),
    costUsd: q4(order.acquisitionCostUsd ?? 0).toFixed(4),
    revenueSrd: "0.0000",
    revenueUsd: "0.0000",
    profitSrd: "0.0000",
    profitUsd: "0.0000"
  }));

  const saleRows = sales.map((order) => ({
    id: order.id,
    createdAt: order.createdAt,
    kind: "SALE",
    status: order.status,
    physicalWeight: order.physicalWeight,
    costSrd: q4(D(order.averageAcquisitionCostUsd ?? 0).mul(D(order.lockedUsdToSrdRate ?? 0))).toFixed(4),
    costUsd: q4(order.averageAcquisitionCostUsd ?? 0).toFixed(4),
    revenueSrd: q4(D(order.negotiatedTotalUsd ?? 0).mul(D(order.lockedUsdToSrdRate ?? 0))).toFixed(4),
    revenueUsd: q4(order.negotiatedTotalUsd ?? 0).toFixed(4),
    profitSrd:
      order.status === OrderStatus.CANCELED
        ? "0.0000"
        : q4(D(order.realizedProfitUsd ?? 0).mul(D(order.lockedUsdToSrdRate ?? 0))).toFixed(4),
    profitUsd:
      order.status === OrderStatus.CANCELED
        ? "0.0000"
        : q4(order.realizedProfitUsd ?? 0).toFixed(4)
  }));

  const timeline = [...purchaseRows, ...saleRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json(timeline);
});

export { router as ledgerRouter };
