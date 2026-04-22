import { GoldTransitStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { DomainError } from "../lib/errors.js";
import { decimalString } from "../lib/schemas.js";
import { mapZodIssuesToFieldErrors } from "../lib/validation.js";
import { prisma } from "../prisma.js";

const router = Router();

const createTransitSchema = z.object({
  destination: z.string().min(2, "Destino obrigatorio."),
  physicalWeight: decimalString,
  dispatchDate: z.string().date(),
  expectedSettlementDate: z.string().date(),
  notes: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(2).optional()
  )
});

router.get("/", async (_req, res) => {
  const rows = await prisma.goldTransitShipment.findMany({
    where: { status: { in: [GoldTransitStatus.IN_TRANSIT, GoldTransitStatus.SETTLED] } },
    orderBy: [{ dispatchDate: "desc" }, { createdAt: "desc" }]
  });

  res.json(rows);
});

router.post("/", async (req, res) => {
  try {
    const payload = createTransitSchema.parse(req.body);

    const created = await prisma.goldTransitShipment.create({
      data: {
        destination: payload.destination,
        physicalWeight: new Prisma.Decimal(payload.physicalWeight),
        dispatchDate: new Date(payload.dispatchDate),
        expectedSettlementDate: new Date(payload.expectedSettlementDate),
        notes: payload.notes ?? null,
        status: GoldTransitStatus.IN_TRANSIT
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

export { router as goldTransitRouter };
