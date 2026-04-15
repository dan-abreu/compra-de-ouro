import { Currency, GoldState } from "@prisma/client";
import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";

import { DomainError, FieldErrorMap } from "../lib/errors.js";
import { prisma } from "../prisma.js";
import { PurchaseOrderService } from "../services/purchase-order-service.js";
import { SalesOrderService } from "../services/sales-order-service.js";

const router = Router();
const purchaseOrderService = new PurchaseOrderService(prisma);
const salesOrderService = new SalesOrderService(prisma);

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a positive decimal string with up to 4 places");

const splitSchema = z.object({
  currency: z.nativeEnum(Currency),
  amount: decimalString,
  manualExchangeRate: decimalString.optional()
});

const createPurchaseSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    isWalkIn: z.boolean().optional().default(false),
    dailyRateId: z.string().min(1).optional(),
    goldState: z.nativeEnum(GoldState),
    physicalWeight: decimalString,
    purityPercentage: decimalString,
    negotiatedPricePerGram: decimalString,
    totalOrderValueUsd: decimalString,
    paymentSplits: z.array(splitSchema).min(1)
  })
  .superRefine((data, ctx) => {
    if (!data.isWalkIn && !data.clientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "clientId is required when isWalkIn is false.",
        path: ["clientId"]
      });
    }
  });

const createSalesSchema = z
  .object({
    supplierId: z.string().min(1).optional(),
    isWalkIn: z.boolean().optional().default(false),
    dailyRateId: z.string().min(1).optional(),
    goldState: z.nativeEnum(GoldState),
    physicalWeight: decimalString,
    purityPercentage: decimalString,
    negotiatedPricePerGram: decimalString,
    totalOrderValueUsd: decimalString,
    paymentSplits: z.array(splitSchema).min(1)
  })
  .superRefine((data, ctx) => {
    if (!data.isWalkIn && !data.supplierId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "supplierId is required when isWalkIn is false.",
        path: ["supplierId"]
      });
    }
  });

const cancelSchema = z.object({
  reason: z.string().max(255).optional()
});

const mapZodIssuesToFieldErrors = (issues: z.ZodIssue[]): FieldErrorMap => {
  return issues.reduce<FieldErrorMap>((acc, issue) => {
    const path = issue.path.join(".");
    if (path && !acc[path]) {
      acc[path] = issue.message;
    }
    return acc;
  }, {});
};

const asyncHandler = <T>(fn: (req: Request, res: Response) => Promise<T>) => {
  return async (req: Request, res: Response, _next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(error.statusCode).json({
          message: error.message,
          code: error.code,
          fieldErrors: error.fieldErrors ?? {}
        });
      }

      if (error instanceof Error && "issues" in error) {
        const zodError = error as z.ZodError;
        return res.status(422).json({
          message: "Invalid payload",
          code: "VALIDATION_ERROR",
          fieldErrors: mapZodIssuesToFieldErrors(zodError.issues),
          issues: zodError.issues
        });
      }

      return res.status(500).json({
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        fieldErrors: {}
      });
    }
  };
};

router.post(
  "/purchase",
  asyncHandler(async (req, res) => {
    const payload = createPurchaseSchema.parse(req.body);
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
        fieldErrors: {}
      });
    }
    const order = await purchaseOrderService.create({
      clientId: payload.clientId,
      isWalkIn: payload.isWalkIn,
      createdById: userId,
      dailyRateId: payload.dailyRateId,
      goldState: payload.goldState,
      physicalWeight: payload.physicalWeight,
      purityPercentage: payload.purityPercentage,
      negotiatedPricePerGramUsd: payload.negotiatedPricePerGram,
      totalOrderValueUsd: payload.totalOrderValueUsd,
      paymentSplits: payload.paymentSplits
    });
    res.status(201).json(order);
  })
);

router.post(
  "/sale",
  asyncHandler(async (req, res) => {
    const payload = createSalesSchema.parse(req.body);
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
        fieldErrors: {}
      });
    }
    const order = await salesOrderService.create({
      supplierId: payload.supplierId,
      isWalkIn: payload.isWalkIn,
      createdById: userId,
      dailyRateId: payload.dailyRateId,
      goldState: payload.goldState,
      physicalWeight: payload.physicalWeight,
      purityPercentage: payload.purityPercentage,
      negotiatedPricePerGramUsd: payload.negotiatedPricePerGram,
      totalOrderValueUsd: payload.totalOrderValueUsd,
      paymentSplits: payload.paymentSplits
    });
    res.status(201).json(order);
  })
);

router.post(
  "/purchase/:orderId/cancel",
  asyncHandler(async (req, res) => {
    cancelSchema.parse(req.body);
    res.status(501).json({ message: "Purchase order cancellation not refactored yet for the new USD schema." });
  })
);

router.post(
  "/sale/:orderId/cancel",
  asyncHandler(async (req, res) => {
    cancelSchema.parse(req.body);
    res.status(501).json({ message: "Sales order cancellation not refactored yet for the new USD schema." });
  })
);

export { router as ordersRouter };
