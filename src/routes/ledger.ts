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
    fineGoldWeight: order.fineGoldWeight,
    costSrd: order.acquisitionCostSrd,
    revenueSrd: "0.0000",
    profitSrd: "0.0000"
  }));

  const saleRows = sales.map((order) => ({
    id: order.id,
    createdAt: order.createdAt,
    kind: "SALE",
    status: order.status,
    fineGoldWeight: order.fineGoldWeightSold,
    costSrd: order.averageAcquisitionCostSrd,
    revenueSrd: order.negotiatedTotalSrd,
    profitSrd: order.status === OrderStatus.CANCELED ? "0.0000" : order.realizedProfitSrd
  }));

  const timeline = [...purchaseRows, ...saleRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json(timeline);
});

export { router as ledgerRouter };
