import { Router } from "express";
import { z } from "zod";

import { createPasswordHash, verifyPassword } from "../../lib/password.js";
import { authMiddleware } from "../../middleware/auth-middleware.js";

const router = Router();

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  currentPassword: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(80)
});

router.post("/profile", authMiddleware, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      message: "Invalid profile payload.",
      code: "VALIDATION_ERROR",
      fieldErrors: {}
    });
  }

  const userId = req.userId;
  const tenantPrisma = req.tenantPrisma;

  if (!userId || !tenantPrisma) {
    return res.status(401).json({
      message: "Authentication required.",
      code: "AUTH_REQUIRED",
      fieldErrors: {}
    });
  }

  const current = await tenantPrisma.user.findUnique({ where: { id: userId } });
  if (!current) {
    return res.status(404).json({
      message: "User not found.",
      code: "USER_NOT_FOUND",
      fieldErrors: {}
    });
  }

  const passwordOk = verifyPassword({
    password: parsed.data.currentPassword,
    storedHash: current.passwordHash
  });

  if (!passwordOk) {
    return res.status(403).json({
      message: "Senha atual invalida.",
      code: "INVALID_SECURITY_PASSWORD",
      fieldErrors: { currentPassword: "Senha atual invalida." }
    });
  }

  try {
    const user = await tenantPrisma.user.update({
      where: { id: userId },
      data: {
        fullName: parsed.data.fullName.trim(),
        email: parsed.data.email.trim().toLowerCase()
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    return res.json(user);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return res.status(409).json({
        message: "Email ja esta em uso.",
        code: "EMAIL_ALREADY_IN_USE",
        fieldErrors: { email: "Email ja esta em uso." }
      });
    }

    console.error("[AUTH] Profile update error:", error);
    return res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }
});

router.post("/password", authMiddleware, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      message: "Invalid password payload.",
      code: "VALIDATION_ERROR",
      fieldErrors: {}
    });
  }

  const userId = req.userId;
  const tenantPrisma = req.tenantPrisma;

  if (!userId || !tenantPrisma) {
    return res.status(401).json({
      message: "Authentication required.",
      code: "AUTH_REQUIRED",
      fieldErrors: {}
    });
  }

  const current = await tenantPrisma.user.findUnique({ where: { id: userId } });
  if (!current) {
    return res.status(404).json({
      message: "User not found.",
      code: "USER_NOT_FOUND",
      fieldErrors: {}
    });
  }

  const passwordOk = verifyPassword({
    password: parsed.data.currentPassword,
    storedHash: current.passwordHash
  });

  if (!passwordOk) {
    return res.status(403).json({
      message: "Senha atual invalida.",
      code: "INVALID_SECURITY_PASSWORD",
      fieldErrors: { currentPassword: "Senha atual invalida." }
    });
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return res.status(422).json({
      message: "A nova senha deve ser diferente da atual.",
      code: "VALIDATION_ERROR",
      fieldErrors: { newPassword: "A nova senha deve ser diferente da atual." }
    });
  }

  await tenantPrisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: createPasswordHash(parsed.data.newPassword)
    }
  });

  return res.json({ ok: true });
});

export { router as authProfileRouter };
