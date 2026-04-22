import { OpexStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { DomainError } from "../lib/errors.js";
import { decimalString } from "../lib/schemas.js";
import { mapZodIssuesToFieldErrors } from "../lib/validation.js";
import { prisma } from "../prisma.js";

const router = Router();

const createOpexSchema = z.object({
  category: z.string().min(2, "Categoria obrigatoria."),
  description: z.string().min(2, "Descricao obrigatoria."),
  amountUsd: decimalString,
  occurredAt: z.string().date()
});

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/", async (req, res) => {
  try {
    const rawDate = typeof req.query.date === "string" ? req.query.date.trim() : null;

    if (rawDate !== null && !ISO_DATE_RE.test(rawDate)) {
      return res.status(422).json({
        message: "Parametro 'date' deve estar no formato YYYY-MM-DD.",
        code: "VALIDATION_ERROR",
        fieldErrors: { date: "Formato invalido. Use YYYY-MM-DD." }
      });
    }

    const where = rawDate
      ? {
          occurredAt: {
            gte: new Date(`${rawDate}T00:00:00.000Z`),
            lte: new Date(`${rawDate}T23:59:59.999Z`)
          },
          status: OpexStatus.ACTIVE
        }
      : { status: OpexStatus.ACTIVE };

    const rows = await prisma.opexEntry.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
    });

    res.json(rows);
  } catch (error) {
    console.error("[opex] GET error:", error);
    return res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }
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
