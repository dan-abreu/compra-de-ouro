import { Router } from "express";
import { z } from "zod";

import { prisma } from "../prisma.js";

const router = Router();

const createSupplierSchema = z.object({
  companyName: z.string().min(2),
  documentId: z.string().min(2),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional()
});

router.get("/", async (_req, res) => {
  const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: "desc" } });
  res.json(suppliers);
});

router.post("/", async (req, res) => {
  try {
    const payload = createSupplierSchema.parse(req.body);
    const created = await prisma.supplier.create({ data: payload });
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ message: "Invalid payload", issues: error.issues });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
});

export { router as suppliersRouter };
