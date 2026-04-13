import { Router } from "express";
import { z } from "zod";

import { prisma } from "../prisma.js";

const router = Router();

const createClientSchema = z.object({
  fullName: z.string().min(2),
  documentId: z.string().min(2),
  phone: z.string().optional(),
  address: z.string().optional(),
  goldOrigin: z.string().optional(),
  kycDocumentUrl: z.string().optional()
});

router.get("/", async (_req, res) => {
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });
  res.json(clients);
});

router.post("/", async (req, res) => {
  try {
    const payload = createClientSchema.parse(req.body);
    const created = await prisma.client.create({ data: payload });
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ message: "Invalid payload", issues: error.issues });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
});

export { router as clientsRouter };
