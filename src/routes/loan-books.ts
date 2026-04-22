import {
  CostBaseType,
  CounterpartyType,
  LoanBookStatus,
  LoanDirection,
  MonthlyCostType,
  Prisma,
  SettlementExpectation
} from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { DomainError } from "../lib/errors.js";
import { isPrismaSchemaOutOfSyncError } from "../lib/errors.js";
import { decimalString, signedDecimalString } from "../lib/schemas.js";
import { ensureTenantSchemaForTrading } from "../lib/tenant-schema-repair.js";
import { mapZodIssuesToFieldErrors } from "../lib/validation.js";

const router = Router();

const positiveDecimalString = decimalString.refine(
  (value) => new Prisma.Decimal(value).gt(0),
  "Informe um valor decimal positivo."
);

const optionalString = (minLength = 1) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(minLength).optional()
  );

const createLoanBookSchema = z.object({
  direction: z.nativeEnum(LoanDirection),
  counterpartyType: z.nativeEnum(CounterpartyType),
  clientId: optionalString(1),
  supplierId: optionalString(1),
  counterpartyName: z.string().min(2, "Nome da contraparte obrigatorio."),
  counterpartyDocument: optionalString(2),
  principalAmountUsd: positiveDecimalString,
  principalInputCurrency: z.enum(["USD", "EUR", "SRD", "GOLD"]).optional(),
  principalInputAmount: positiveDecimalString.optional(),
  settlementExpectation: z.nativeEnum(SettlementExpectation),
  monthlyCostType: z.nativeEnum(MonthlyCostType),
  monthlyRatePercent: optionalString(1),
  monthlyFixedCostUsd: optionalString(1),
  costBaseType: z.nativeEnum(CostBaseType).optional(),
  startDate: z.string().date(),
  dueDate: z.string().date().optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  goldOwedGrams: signedDecimalString.optional(),
  notes: optionalString(2)
}).superRefine((data, ctx) => {
  if (data.monthlyCostType === MonthlyCostType.PERCENTAGE) {
    if (!data.monthlyRatePercent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a taxa percentual mensal.",
        path: ["monthlyRatePercent"]
      });
    }

    if (!data.costBaseType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a base de calculo dos juros.",
        path: ["costBaseType"]
      });
    }
  }

  if (data.monthlyCostType === MonthlyCostType.FIXED && !data.monthlyFixedCostUsd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe o valor fixo mensal.",
      path: ["monthlyFixedCostUsd"]
    });
  }
});

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

    let rows;
    try {
      rows = await tenantPrisma.loanBookEntry.findMany({
        where: { status: { in: [LoanBookStatus.OPEN, LoanBookStatus.SETTLED] } },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
      });
    } catch (error) {
      if (!isPrismaSchemaOutOfSyncError(error)) {
        throw error;
      }

      await ensureTenantSchemaForTrading(tenantPrisma);
      rows = await tenantPrisma.loanBookEntry.findMany({
        where: { status: { in: [LoanBookStatus.OPEN, LoanBookStatus.SETTLED] } },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
      });
    }

    res.json(rows);
  } catch (error) {
    if (error instanceof DomainError) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
        fieldErrors: error.fieldErrors ?? {}
      });
    }

    console.error("[loan-books] GET error:", error);
    return res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const tenantPrisma = req.tenantPrisma;
    if (!tenantPrisma) {
      return res.status(401).json({
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
        fieldErrors: {}
      });
    }

    const payload = createLoanBookSchema.parse(req.body);
    const principalAmountUsd = new Prisma.Decimal(payload.principalAmountUsd);
    const principalInputCurrency = payload.principalInputCurrency ?? "USD";
    const principalInputAmount = payload.principalInputAmount
      ? new Prisma.Decimal(payload.principalInputAmount)
      : principalAmountUsd;
    const directionSign = payload.direction === LoanDirection.RECEIVED ? new Prisma.Decimal(-1) : new Prisma.Decimal(1);
    const signedBalance = principalAmountUsd.mul(directionSign);
    const monthlyRatePercent = payload.monthlyRatePercent ? new Prisma.Decimal(payload.monthlyRatePercent) : null;
    const monthlyFixedCostUsd = payload.monthlyFixedCostUsd ? new Prisma.Decimal(payload.monthlyFixedCostUsd) : null;
    const goldOwedGrams = payload.goldOwedGrams ? new Prisma.Decimal(payload.goldOwedGrams) : new Prisma.Decimal(0);

    const createData = {
      direction: payload.direction,
      counterpartyType: payload.counterpartyType,
      clientId: payload.clientId ?? null,
      supplierId: payload.supplierId ?? null,
      counterpartyName: payload.counterpartyName,
      counterpartyDocument: payload.counterpartyDocument ?? null,
      principalAmountUsd,
      principalInputCurrency,
      principalInputAmount,
      runningBalanceUsd: signedBalance,
      frontMoneyUsd: signedBalance,
      goldOwedGrams,
      settlementExpectation: payload.settlementExpectation,
      monthlyCostType: payload.monthlyCostType,
      monthlyRatePercent,
      monthlyFixedCostUsd,
      costBaseType: payload.costBaseType ?? null,
      startDate: new Date(`${payload.startDate}T00:00:00.000Z`),
      dueDate: payload.dueDate ? new Date(`${payload.dueDate}T00:00:00.000Z`) : null,
      billingDay: payload.billingDay ?? null,
      notes: payload.notes ?? null,
      status: LoanBookStatus.OPEN
    };

    let created;
    try {
      created = await tenantPrisma.loanBookEntry.create({ data: createData });
    } catch (error) {
      if (!isPrismaSchemaOutOfSyncError(error)) {
        throw error;
      }

      await ensureTenantSchemaForTrading(tenantPrisma);
      created = await tenantPrisma.loanBookEntry.create({ data: createData });
    }

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof DomainError) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
        fieldErrors: error.fieldErrors ?? {}
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(422).json({
        message: "Payload invalido.",
        code: "VALIDATION_ERROR",
        fieldErrors: mapZodIssuesToFieldErrors(error.issues),
        issues: error.issues
      });
    }

    return res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }
});

export { router as loanBooksRouter };
