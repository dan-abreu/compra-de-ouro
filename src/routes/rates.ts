import { Request, Response, Router } from "express";
import { RecordStatus } from "@prisma/client";
import { z } from "zod";

import { DomainError, FieldErrorMap } from "../lib/errors.js";
import { prisma } from "../prisma.js";

const router = Router();

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a positive decimal string with up to 4 places");

const createRateSchema = z.object({
  rateDate: z.string().date(),
  createdById: z.string().min(1),
  goldPricePerGramUsd: decimalString,
  usdToSrdRate: decimalString,
  eurToUsdRate: decimalString
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

const assertPositiveDecimal = (value: string, field: string, label: string) => {
  if (Number(value) <= 0) {
    throw new DomainError(`${label} deve ser maior que zero.`, 422, {
      code: "VALIDATION_ERROR",
      fieldErrors: { [field]: `${label} deve ser maior que zero.` }
    });
  }
};

router.post("/", async (req: Request, res: Response) => {
  try {
    const payload = createRateSchema.parse(req.body);
    assertPositiveDecimal(payload.goldPricePerGramUsd, "goldPricePerGramUsd", "Preco do ouro por grama em USD");
    assertPositiveDecimal(payload.usdToSrdRate, "usdToSrdRate", "Taxa USD para SRD");
    assertPositiveDecimal(payload.eurToUsdRate, "eurToUsdRate", "Taxa EUR para USD");

    const [operator, existingRate] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.createdById } }),
      prisma.dailyRate.findUnique({ where: { rateDate: new Date(payload.rateDate) } })
    ]);

    if (!operator || operator.status !== RecordStatus.ACTIVE) {
      throw new DomainError("Operador invalido ou inativo.", 422, {
        code: "OPERATOR_INVALID",
        fieldErrors: { createdById: "Operador invalido ou inativo." }
      });
    }

    if (existingRate) {
      throw new DomainError("Ja existe taxa cadastrada para esta data.", 409, {
        code: "RATE_DATE_DUPLICATE",
        fieldErrors: { rateDate: "Ja existe taxa para esta data." }
      });
    }

    const created = await prisma.dailyRate.create({
      data: {
        rateDate: new Date(payload.rateDate),
        createdById: payload.createdById,
        goldPricePerGramUsd: payload.goldPricePerGramUsd,
        usdToSrdRate: payload.usdToSrdRate,
        eurToUsdRate: payload.eurToUsdRate
      }
    });

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return res.status(422).json({
        message: "Payload invalido.",
        code: "VALIDATION_ERROR",
        fieldErrors: mapZodIssuesToFieldErrors(zodError.issues),
        issues: zodError.issues
      });
    }

    if (error instanceof DomainError) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
        fieldErrors: error.fieldErrors ?? {}
      });
    }

    return res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }
});

router.get("/latest", async (_req: Request, res: Response) => {
  const latest = await prisma.dailyRate.findFirst({
    orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }]
  });

  if (!latest) {
    return res.status(404).json({
      message: "No DailyRate configured.",
      code: "RATE_NOT_FOUND",
      fieldErrors: {}
    });
  }

  return res.json(latest);
});

export { router as ratesRouter };
