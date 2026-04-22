import { Request, Response, Router } from "express";
import { z } from "zod";

import { DomainError, mapInfrastructureError } from "../lib/errors.js";
import { decimalString } from "../lib/schemas.js";
import { mapZodIssuesToFieldErrors } from "../lib/validation.js";
import { prisma } from "../prisma.js";
import { buildMarketLivePayload } from "../services/market-live-service.js";
import { createDailyRate, getLatestRateWithSchemaRepair, upsertManualGoldPrice } from "../services/rates-service.js";

const router = Router();

const createRateSchema = z.object({
  rateDate: z.string().date(),
  createdById: z.string().min(1),
  goldPricePerGramUsd: decimalString,
  usdToSrdRate: decimalString,
  eurToUsdRate: decimalString
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const payload = createRateSchema.parse(req.body);
    const created = await createDailyRate(prisma, payload);

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      const zodError = error as z.ZodError;
      return res.status(422).json({
        message: "Payload invalido.",
        code: "VALIDATION_ERROR",
        fieldErrors: mapZodIssuesToFieldErrors(zodError.issues),
        issues: zodError.issues
      });
    }

    if (error instanceof DomainError) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
        fieldErrors: error.fieldErrors ?? {}
      });
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

router.get("/latest", async (_req: Request, res: Response) => {
  try {
    const latest = await getLatestRateWithSchemaRepair(prisma);

    if (!latest) {
      return res.status(404).json({
        message: "No DailyRate configured.",
        code: "RATE_NOT_FOUND",
        fieldErrors: {}
      });
    }

    return res.json(latest);
  } catch (error) {
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

router.get("/market-live", async (_req: Request, res: Response) => {
  try {
    const payload = await buildMarketLivePayload();
    return res.json(payload);
  } catch (error) {
    console.error("[rates] buildMarketLivePayload failed:", error);
    return res.status(503).json({
      message: "Market live feed unavailable.",
      code: "MARKET_LIVE_UNAVAILABLE",
      fieldErrors: {}
    });
  }
});

/**
 * PUT /market-gold - Atualização manual do preço do ouro
 * Permite ao operador atualizar o preço do ouro com valor pesquisado manualmente
 * (ex: de sites como KITCO, TradingView, etc)
 */
router.put(
  "/market-gold",
  async (req: Request, res: Response) => {
    try {
      const { goldPricePerGramUsd } = req.body;

      if (!goldPricePerGramUsd) {
        return res.status(400).json({
          message: "goldPricePerGramUsd é obrigatório",
          code: "MISSING_FIELD",
          fieldErrors: { goldPricePerGramUsd: "Requerido" }
        });
      }

      const parsed = decimalString.safeParse(goldPricePerGramUsd);
      if (!parsed.success) {
        return res.status(422).json({
          message: "goldPricePerGramUsd deve ser um número decimal positivo com até 4 casas decimais.",
          code: "VALIDATION_ERROR",
          fieldErrors: { goldPricePerGramUsd: parsed.error.issues[0]?.message ?? "Valor inválido." }
        });
      }

      const data = await upsertManualGoldPrice(prisma, parsed.data);

      return res.json({
        message: "Preço do ouro atualizado com sucesso",
        data
      });
    } catch (error) {
      console.error("[rates] Erro ao atualizar ouro:", error);

      if (error instanceof Error && "issues" in error) {
        const zodError = error as z.ZodError;
        return res.status(422).json({
          message: "Dados inválidos",
          code: "VALIDATION_ERROR",
          fieldErrors: mapZodIssuesToFieldErrors(zodError.issues)
        });
      }

      if (error instanceof DomainError) {
        return res.status(error.statusCode).json({
          message: error.message,
          code: error.code,
          fieldErrors: error.fieldErrors ?? {}
        });
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
        message: "Erro ao atualizar preço do ouro",
        code: "INTERNAL_SERVER_ERROR",
        fieldErrors: {}
      });
    }
  }
);

export { router as ratesRouter };
