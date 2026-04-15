import { LoanBookStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { DomainError, FieldErrorMap } from "../lib/errors.js";
import { prisma } from "../prisma.js";

const router = Router();

const decimalString = z
  .string()
  .regex(/^-?\d+(\.\d{1,4})?$/, "Must be a decimal string with up to 4 places");

const optionalString = (minLength = 1) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(minLength).optional()
  );

const createLoanBookSchema = z.object({
  clientId: optionalString(1),
  counterpartyName: z.string().min(2, "Nome da contraparte obrigatorio."),
  runningBalanceUsd: decimalString,
  frontMoneyUsd: decimalString,
  goldOwedGrams: decimalString,
  notes: optionalString(2)
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

router.get("/", async (_req, res) => {
  const rows = await prisma.loanBookEntry.findMany({
    where: { status: { in: [LoanBookStatus.OPEN, LoanBookStatus.SETTLED] } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
  });

  res.json(rows);
});

router.post("/", async (req, res) => {
  try {
    const payload = createLoanBookSchema.parse(req.body);

    const created = await prisma.loanBookEntry.create({
      data: {
        clientId: payload.clientId ?? null,
        counterpartyName: payload.counterpartyName,
        runningBalanceUsd: new Prisma.Decimal(payload.runningBalanceUsd),
        frontMoneyUsd: new Prisma.Decimal(payload.frontMoneyUsd),
        goldOwedGrams: new Prisma.Decimal(payload.goldOwedGrams),
        notes: payload.notes ?? null,
        status: LoanBookStatus.OPEN
      }
    });

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
