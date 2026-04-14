import { Prisma } from "@prisma/client";
import { Router } from "express";

import { prisma } from "../prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  let vault = await prisma.vault.findUnique({ where: { code: "MAIN" } });

  if (!vault) {
    vault = await prisma.vault.create({
      data: {
        code: "MAIN",
        balanceGoldGrams: new Prisma.Decimal("0.0000"),
        balanceSrd: new Prisma.Decimal("0.0000"),
        balanceUsd: new Prisma.Decimal("0.0000"),
        balanceEur: new Prisma.Decimal("0.0000"),
        openGoldGrams: new Prisma.Decimal("0.0000"),
        openGoldAcquisitionCostUsd: new Prisma.Decimal("0.0000")
      }
    });
  }

  return res.json(vault);
});

export { router as vaultRouter };
