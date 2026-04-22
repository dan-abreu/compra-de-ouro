import { RecordStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { buildTenantAccessToken } from "../../lib/jwt.js";
import { verifyPassword } from "../../lib/password.js";
import { authMiddleware } from "../../middleware/auth-middleware.js";

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

  let user: Awaited<ReturnType<typeof tenantPrisma.user.findUnique>>;
  try {
    user = await tenantPrisma.user.findUnique({
      where: { email: parsed.data.email }
    });
  } catch (error) {
    console.error("[AUTH] DB error during login:", error);
    return res.status(500).json({
      message: "Authentication service unavailable.",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }

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

  let accessToken: string;
  try {
    accessToken = buildTenantAccessToken({
      tenantId,
      userId: user.id,
      role: user.role
    });
  } catch (error) {
    console.error("[AUTH] Token generation error:", error);
    return res.status(500).json({
      message: "Authentication service unavailable.",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }

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

router.get("/me", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const tenantPrisma = req.tenantPrisma;

  if (!userId || !tenantPrisma) {
    return res.status(401).json({
      message: "Authentication required.",
      code: "AUTH_REQUIRED",
      fieldErrors: {}
    });
  }

  // eslint-disable-next-line prefer-const
  let user: { id: string; fullName: string; email: string; role: string; status: string; createdAt: Date } | null | undefined;
  try {
    user = await tenantPrisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });
  } catch (error) {
    console.error("[AUTH] DB error on /me:", error);
    return res.status(500).json({
      message: "Authentication service unavailable.",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }

  if (!user) {
    return res.status(404).json({
      message: "User not found.",
      code: "USER_NOT_FOUND",
      fieldErrors: {}
    });
  }

  return res.json(user);
});

export { router as authSessionRouter };
