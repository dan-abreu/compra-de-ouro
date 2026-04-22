import { RecordStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import {
  getOrderCancelSecurityConfig,
  setOrderCancelSecurityPasswordHash
} from "../../lib/security-config.js";
import { createPasswordHash, verifyPassword } from "../../lib/password.js";
import { authMiddleware } from "../../middleware/auth-middleware.js";

const router = Router();

const setCancelPasswordSchema = z
  .object({
    adminPassword: z.string().min(1),
    cancelSecurityPassword: z.string().min(6).max(80),
    confirmCancelSecurityPassword: z.string().min(6).max(80)
  })
  .superRefine((data, ctx) => {
    if (data.cancelSecurityPassword !== data.confirmCancelSecurityPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Confirmacao da senha de cancelamento nao confere.",
        path: ["confirmCancelSecurityPassword"]
      });
    }
  });

router.get("/cancel-security-password/status", authMiddleware, async (req, res) => {
  try {
    const tenantPrisma = req.tenantPrisma;
    if (!tenantPrisma) {
      return res.status(401).json({
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
        fieldErrors: {}
      });
    }

    const config = await getOrderCancelSecurityConfig(tenantPrisma);
    let updatedByName: string | null = null;

    if (config?.updatedById) {
      const admin = await tenantPrisma.user.findUnique({
        where: { id: config.updatedById },
        select: { fullName: true }
      });
      updatedByName = admin?.fullName ?? null;
    }

    return res.json({
      configured: Boolean(config?.value && config.value.trim().length > 0),
      updatedAt: config?.updatedAt ?? null,
      updatedById: config?.updatedById ?? null,
      updatedByName
    });
  } catch (error) {
    console.error("[AUTH] cancel-security-password/status error:", error);
    return res.status(500).json({
      message: "Failed to load cancel security password status.",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }
});

router.post("/cancel-security-password", authMiddleware, async (req, res) => {
  try {
    const parsed = setCancelPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        message: "Invalid cancel security password payload.",
        code: "VALIDATION_ERROR",
        fieldErrors: {}
      });
    }

    const userId = req.userId;
    const userRole = req.userRole;
    const tenantPrisma = req.tenantPrisma;

    if (!userId || !tenantPrisma) {
      return res.status(401).json({
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
        fieldErrors: {}
      });
    }

    if (userRole !== "ADMIN") {
      return res.status(403).json({
        message: "Apenas administradores podem definir a senha de cancelamento.",
        code: "ADMIN_REQUIRED",
        fieldErrors: {}
      });
    }

    const admin = await tenantPrisma.user.findUnique({ where: { id: userId } });
    if (!admin || admin.status !== RecordStatus.ACTIVE || admin.role !== "ADMIN") {
      return res.status(403).json({
        message: "Apenas administradores ativos podem definir a senha de cancelamento.",
        code: "ADMIN_REQUIRED",
        fieldErrors: {}
      });
    }

    const adminPasswordOk = verifyPassword({
      password: parsed.data.adminPassword,
      storedHash: admin.passwordHash
    });

    if (!adminPasswordOk) {
      return res.status(403).json({
        message: "Senha do administrador invalida.",
        code: "INVALID_SECURITY_PASSWORD",
        fieldErrors: { adminPassword: "Senha do administrador invalida." }
      });
    }

    await setOrderCancelSecurityPasswordHash(tenantPrisma, {
      hash: createPasswordHash(parsed.data.cancelSecurityPassword),
      updatedById: admin.id
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("[AUTH] cancel-security-password error:", error);
    return res.status(500).json({
      message: "Failed to update cancel security password.",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }
});

export { router as authCancelSecurityRouter };
