import { Request, Response, Router } from "express";
import { z } from "zod";

import { DomainError } from "../lib/errors.js";
import { prisma } from "../prisma.js";

const router = Router();

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a positive decimal string with up to 4 places");

const createRateSchema = z.object({
  rateDate: z.string().date(),
  createdById: z.string().min(1),
  goldPricePerGram: decimalString,
  usdToSrdRate: decimalString,
  eurToSrdRate: decimalString
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const payload = createRateSchema.parse(req.body);

    const created = await prisma.dailyRate.create({
      data: {
        rateDate: new Date(payload.rateDate),
        createdById: payload.createdById,
        goldPricePerGram: payload.goldPricePerGram,
        usdToSrdRate: payload.usdToSrdRate,
        eurToSrdRate: payload.eurToSrdRate
      }
    });

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return res.status(422).json({ message: "Invalid payload", issues: (error as z.ZodError).issues });
    }

    if (error instanceof DomainError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/latest", async (_req: Request, res: Response) => {
  const latest = await prisma.dailyRate.findFirst({
    orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }]
  });

  if (!latest) {
    return res.status(404).json({ message: "No DailyRate configured." });
  }

  return res.json(latest);
});

export { router as ratesRouter };
