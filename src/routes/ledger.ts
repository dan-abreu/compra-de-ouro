import { OrderStatus } from "@prisma/client";
import { Router } from "express";

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
    costSrd: (Number(order.acquisitionCostUsd || 0) * Number(order.lockedUsdToSrdRate || 0)).toFixed(4),
    costUsd: Number(order.acquisitionCostUsd || 0).toFixed(4),
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
    costSrd: (Number(order.averageAcquisitionCostUsd || 0) * Number(order.lockedUsdToSrdRate || 0)).toFixed(4),
    costUsd: Number(order.averageAcquisitionCostUsd || 0).toFixed(4),
    revenueSrd: (Number(order.negotiatedTotalUsd || 0) * Number(order.lockedUsdToSrdRate || 0)).toFixed(4),
    revenueUsd: Number(order.negotiatedTotalUsd || 0).toFixed(4),
    profitSrd:
      order.status === OrderStatus.CANCELED
        ? "0.0000"
        : (Number(order.realizedProfitUsd || 0) * Number(order.lockedUsdToSrdRate || 0)).toFixed(4),
    profitUsd:
      order.status === OrderStatus.CANCELED
        ? "0.0000"
        : Number(order.realizedProfitUsd || 0).toFixed(4)
  }));

  const timeline = [...purchaseRows, ...saleRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json(timeline);
});

export { router as ledgerRouter };
