import { OpexStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { DomainError, FieldErrorMap } from "../lib/errors.js";
import { prisma } from "../prisma.js";

const router = Router();

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a positive decimal string with up to 4 places");

const createOpexSchema = z.object({
  category: z.string().min(2, "Categoria obrigatoria."),
  description: z.string().min(2, "Descricao obrigatoria."),
  amountUsd: decimalString,
  occurredAt: z.string().date()
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

router.get("/", async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : null;

  const where = date
    ? {
        occurredAt: {
          gte: new Date(`${date}T00:00:00.000Z`),
          lte: new Date(`${date}T23:59:59.999Z`)
        },
        status: OpexStatus.ACTIVE
      }
    : { status: OpexStatus.ACTIVE };

  const rows = await prisma.opexEntry.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
  });

  res.json(rows);
});

router.post("/", async (req, res) => {
  try {
    const payload = createOpexSchema.parse(req.body);

    const created = await prisma.opexEntry.create({
      data: {
        category: payload.category,
        description: payload.description,
        amountUsd: new Prisma.Decimal(payload.amountUsd),
        occurredAt: new Date(payload.occurredAt),
        status: OpexStatus.ACTIVE
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

export { router as opexRouter };
