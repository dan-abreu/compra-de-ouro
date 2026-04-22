import { Router } from "express";

import { isPrismaMissingColumnError, mapInfrastructureError } from "../lib/errors.js";
import { ensureTenantSchemaForTrading } from "../lib/tenant-schema-repair.js";
import { getOrCreateMainVault } from "../lib/vault-utils.js";
import { prisma } from "../prisma.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const vault = await getOrCreateMainVault(prisma);
    return res.json(vault);
  } catch (error) {
    if (isPrismaMissingColumnError(error)) {
      await ensureTenantSchemaForTrading(prisma);

      try {
        const repairedVault = await getOrCreateMainVault(prisma);
        return res.json(repairedVault);
      } catch (retryError) {
        const retryInfraError = mapInfrastructureError(retryError);
        if (retryInfraError) {
          return res.status(retryInfraError.statusCode).json({
            message: retryInfraError.message,
            code: retryInfraError.code,
            fieldErrors: retryInfraError.fieldErrors ?? {}
          });
        }

        return res.status(500).json({
          message: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
          fieldErrors: {}
        });
      }
    }

    const infraError = mapInfrastructureError(error);
    if (infraError) {
      return res.status(infraError.statusCode).json({
        message: infraError.message,
        code: infraError.code,
        fieldErrors: infraError.fieldErrors ?? {}
      });
    }

    return res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }
});

export { router as vaultRouter };
