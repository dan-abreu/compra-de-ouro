import { Currency } from "@prisma/client";
import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";

import { DomainError } from "../lib/errors.js";
import { prisma } from "../prisma.js";
import { OrderService } from "../services/order-service.js";

const router = Router();
const orderService = new OrderService(prisma);

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a positive decimal string with up to 4 places");

const splitSchema = z.object({
  currency: z.nativeEnum(Currency),
  amount: decimalString
});

const createPurchaseSchema = z.object({
  clientId: z.string().min(1),
  createdById: z.string().min(1),
  dailyRateId: z.string().min(1).optional(),
  grossWeight: decimalString,
  netWeight: decimalString,
  purityPercentage: decimalString,
  paymentSplits: z.array(splitSchema).min(1)
});

const createSalesSchema = z.object({
  supplierId: z.string().min(1),
  createdById: z.string().min(1),
  dailyRateId: z.string().min(1).optional(),
  fineGoldWeightSold: decimalString,
  negotiatedTotalSrd: decimalString,
  paymentSplits: z.array(splitSchema).min(1)
});

const cancelSchema = z.object({
  canceledById: z.string().min(1),
  reason: z.string().max(255).optional()
});

const asyncHandler = <T>(fn: (req: Request, res: Response) => Promise<T>) => {
  return async (req: Request, res: Response, _next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      if (error instanceof Error && "issues" in error) {
        return res.status(422).json({ message: "Invalid payload", issues: (error as z.ZodError).issues });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  };
};

router.post(
  "/purchase",
  asyncHandler(async (req, res) => {
    const payload = createPurchaseSchema.parse(req.body);
    const order = await orderService.createPurchaseOrder(payload);
    res.status(201).json(order);
  })
);

router.post(
  "/sale",
  asyncHandler(async (req, res) => {
    const payload = createSalesSchema.parse(req.body);
    const order = await orderService.createSalesOrder(payload);
    res.status(201).json(order);
  })
);

router.post(
  "/purchase/:orderId/cancel",
  asyncHandler(async (req, res) => {
    const payload = cancelSchema.parse(req.body);
    const order = await orderService.cancelPurchaseOrder({
      orderId: req.params.orderId,
      canceledById: payload.canceledById,
      reason: payload.reason
    });

    res.status(200).json(order);
  })
);

router.post(
  "/sale/:orderId/cancel",
  asyncHandler(async (req, res) => {
    const payload = cancelSchema.parse(req.body);
    const order = await orderService.cancelSalesOrder({
      orderId: req.params.orderId,
      canceledById: payload.canceledById,
      reason: payload.reason
    });

    res.status(200).json(order);
  })
);

export { router as ordersRouter };
