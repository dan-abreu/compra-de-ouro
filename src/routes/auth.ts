import { RecordStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { buildTenantAccessToken } from "../lib/jwt.js";
import { verifyPassword } from "../lib/password.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error("[AUTH] Validation error:", parsed.error);
    return res.status(422).json({
      message: "Invalid login payload.",
      code: "VALIDATION_ERROR",
      fieldErrors: {}
    });
  }

  const tenantId = req.tenantId;
  const tenantPrisma = req.tenantPrisma;
  console.log(`[AUTH] Login attempt - tenantId: ${tenantId}, email: ${parsed.data.email}`);
  
  if (!tenantId || !tenantPrisma) {
    console.error("[AUTH] Missing tenant context");
    return res.status(400).json({
      message: "Tenant context not found. Check X-Tenant-ID header or subdomain.",
      code: "TENANT_CONTEXT_MISSING",
      fieldErrors: {}
    });
  }

  const user = await tenantPrisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  if (!user) {
    console.error(`[AUTH] User not found - email: ${parsed.data.email}`);
    return res.status(401).json({
      message: "Invalid credentials.",
      code: "INVALID_CREDENTIALS",
      fieldErrors: {}
    });
  }

  if (user.status !== RecordStatus.ACTIVE) {
    console.error(`[AUTH] User inactive - email: ${parsed.data.email}, status: ${user.status}`);
    return res.status(401).json({
      message: "Invalid credentials.",
      code: "INVALID_CREDENTIALS",
      fieldErrors: {}
    });
  }

  const passwordOk = verifyPassword({
    password: parsed.data.password,
    storedHash: user.passwordHash
  });

  if (!passwordOk) {
    console.error(`[AUTH] Password mismatch - email: ${parsed.data.email}`);
    return res.status(401).json({
      message: "Invalid credentials.",
      code: "INVALID_CREDENTIALS",
      fieldErrors: {}
    });
  }

  const accessToken = buildTenantAccessToken({
    tenantId,
    userId: user.id,
    role: user.role
  });

  return res.json({
    accessToken,
    tokenType: "Bearer",
    tenantId,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    }
  });
});

export { router as authRouter };
