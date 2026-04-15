import { Router } from "express";
import { z } from "zod";

import { provisionNewTenant } from "../tenant/provisioning.js";

const router = Router();

const MASTER_API_KEY = process.env.MASTER_API_KEY?.trim();

const requireMasterKey = (req: any, res: any, next: any) => {
  const provided = req.headers["x-master-key"];
  if (!MASTER_API_KEY || provided !== MASTER_API_KEY) {
    return res.status(401).json({ message: "Unauthorized.", code: "UNAUTHORIZED" });
  }
  next();
};

const provisionSchema = z.object({
  companyName: z.string().min(2).max(180),
  adminName: z.string().min(2).max(120),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8)
});

router.post("/provision", requireMasterKey, async (req, res) => {
  const parsed = provisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      message: "Invalid payload.",
      code: "VALIDATION_ERROR",
      fieldErrors: {}
    });
  }

  try {
    const result = await provisionNewTenant(parsed.data);
    return res.status(201).json({
      message: "Tenant provisioned successfully.",
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Provisioning failed.",
      code: "TENANT_PROVISION_ERROR",
      fieldErrors: {}
    });
  }
});

export { router as masterAdminRouter };
