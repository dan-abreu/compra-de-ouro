import { OrderStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { D, q4 } from "../lib/decimal.js";
import { DomainError, mapInfrastructureError } from "../lib/errors.js";
import { OrderCancellationService } from "../services/order-cancellation-service.js";

const router = Router();

const cancelOrderSchema = z.object({
  securityPassword: z.string().min(1, "Security password is required."),
  reason: z.string().max(255).optional()
});

router.get("/", async (req, res) => {
  const tenantPrisma = req.tenantPrisma;

  if (!tenantPrisma) {
    return res.status(400).json({
      message: "Tenant context not found.",
      code: "TENANT_CONTEXT_MISSING",
      fieldErrors: {}
    });
  }

  let purchases: Awaited<ReturnType<typeof tenantPrisma.purchaseOrder.findMany>>;
  let sales: Awaited<ReturnType<typeof tenantPrisma.salesOrder.findMany>>;

  try {
    [purchases, sales] = await Promise.all([
      tenantPrisma.purchaseOrder.findMany({ orderBy: { createdAt: "desc" } }),
      tenantPrisma.salesOrder.findMany({ orderBy: { createdAt: "desc" } })
    ]);
  } catch (error) {
    const infraError = mapInfrastructureError(error);
    if (infraError) {
      return res.status(infraError.statusCode).json({
        message: infraError.message,
        code: infraError.code,
        fieldErrors: infraError.fieldErrors ?? {}
      });
    }
    console.error("[ledger] GET error:", error);
    return res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }

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

router.post("/:kind/:orderId/cancel", async (req, res) => {
  try {
    const kind = req.params.kind;
    const orderId = req.params.orderId;
    const userId = req.userId;
    const tenantPrisma = req.tenantPrisma;

    if (!userId || !tenantPrisma) {
      return res.status(401).json({
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
        fieldErrors: {}
      });
    }

    const payload = cancelOrderSchema.parse(req.body);

    if (kind !== "purchase" && kind !== "sale") {
      return res.status(422).json({
        message: "Invalid order kind.",
        code: "VALIDATION_ERROR",
        fieldErrors: { kind: "Use 'purchase' or 'sale'." }
      });
    }

    const cancellationService = new OrderCancellationService(tenantPrisma);

    const result =
      kind === "purchase"
        ? await cancellationService.cancelPurchase({
            orderId,
            canceledById: userId,
            securityPassword: payload.securityPassword,
            reason: payload.reason
          })
        : await cancellationService.cancelSale({
            orderId,
            canceledById: userId,
            securityPassword: payload.securityPassword,
            reason: payload.reason
          });

    return res.json({
      id: result.id,
      status: result.status,
      canceledAt: result.canceledAt,
      cancelReason: result.cancelReason
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
        fieldErrors: error.fieldErrors ?? {}
      });
    }

    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.reduce<Record<string, string>>((acc, issue) => {
        const path = issue.path.join(".");
        if (path && !acc[path]) {
          acc[path] = issue.message;
        }
        return acc;
      }, {});

      return res.status(422).json({
        message: "Invalid payload",
        code: "VALIDATION_ERROR",
        fieldErrors
      });
    }

    const infraError = mapInfrastructureError(error);
    if (infraError) {
      return res.status(infraError.statusCode).json({
        message: infraError.message,
        code: infraError.code,
        fieldErrors: infraError.fieldErrors ?? {}
      });
    }

    console.error("[ledger] cancel error:", error);
    return res.status(500).json({ message: "Internal server error", code: "INTERNAL_SERVER_ERROR" });
  }
});

export { router as ledgerRouter };
