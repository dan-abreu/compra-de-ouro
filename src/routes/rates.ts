import { Request, Response, Router } from "express";
import { RecordStatus } from "@prisma/client";
import { Decimal } from "decimal.js";
import { z } from "zod";

import { D, q4 } from "../lib/decimal.js";
import { DomainError, FieldErrorMap } from "../lib/errors.js";
import { prisma } from "../prisma.js";

const router = Router();
const OUNCE_IN_GRAMS = 31.1035;
const LIVE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas para evitar limite do Stooq

type MarketSource = {
  symbol: string;
  provider: string;
  url: string;
  note: string;
};

type MarketLiveResponse = {
  rateDate: string;
  goldPricePerGramUsd: string;
  usdToSrdRate: string;
  eurToUsdRate: string;
  fetchedAt: string;
  sourceMode: "external-live" | "database-cached" | "manual-input";
  lastUpdatedBy?: string;
  sources: MarketSource[];
};

type GoldQuoteSource = {
  priceOz: Decimal;
  source: MarketSource;
  sourceMode: "external-live" | "database-cached";
};

let marketLiveCache: { expiresAt: number; payload: MarketLiveResponse } | null = null;

const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a positive decimal string with up to 4 places");

const createRateSchema = z.object({
  rateDate: z.string().date(),
  createdById: z.string().min(1),
  goldPricePerGramUsd: decimalString,
  usdToSrdRate: decimalString,
  eurToUsdRate: decimalString
});

const mapZodIssuesToFieldErrors = (issues: z.ZodIssue[]): FieldErrorMap => {
  return issues.reduce<FieldErrorMap>((acc, issue) => {
    const path = issue.path.join(".");
    if (path && !acc[path]) {
      acc[path] = issue.message;
    }
    return acc;
  }, {});
};

const assertPositiveDecimal = (value: string, field: string, label: string) => {
  if (D(value).lte(0)) {
    throw new DomainError(`${label} deve ser maior que zero.`, 422, {
      code: "VALIDATION_ERROR",
      fieldErrors: { [field]: `${label} deve ser maior que zero.` }
    });
  }
};

const round4 = (value: Decimal.Value) => q4(value).toFixed(4);

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "compra-de-ouro-api/1.0",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }

  return (await response.json()) as T;
};

const fetchGoldFromGoldApiPublic = async (): Promise<GoldQuoteSource> => {
  const quote = await fetchJson<{ price?: number }>("https://api.gold-api.com/price/XAU/USD");

  if (!quote.price) {
    throw new Error("Invalid XAU/USD quote from gold-api.com");
  }

  const priceOz = D(quote.price);
  if (priceOz.lte(0)) {
    throw new Error("Invalid XAU/USD quote from gold-api.com");
  }

  return {
    priceOz,
    sourceMode: "external-live",
    source: {
      symbol: "XAU/USD",
      provider: "Gold-API.com",
      url: "https://api.gold-api.com/price/XAU/USD",
      note: "Spot XAU/USD sem chave"
    }
  };
};

const fetchGoldFromCoinGeckoProxy = async (): Promise<GoldQuoteSource> => {
  const quote = await fetchJson<{ "tether-gold"?: { usd?: number } }>(
    "https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd"
  );

  const priceRaw = quote["tether-gold"]?.usd;
  if (!priceRaw) {
    throw new Error("Invalid XAUT/USD quote from CoinGecko");
  }

  const priceOz = D(priceRaw);
  if (priceOz.lte(0)) {
    throw new Error("Invalid XAUT/USD quote from CoinGecko");
  }

  return {
    priceOz,
    sourceMode: "external-live",
    source: {
      symbol: "XAUT/USD",
      provider: "CoinGecko",
      url: "https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd",
      note: "Proxy de mercado para ouro spot (token lastreado em ouro)"
    }
  };
};

const fetchGoldPriceOz = async (): Promise<GoldQuoteSource | null> => {
  try {
    const publicGoldApiQuote = await fetchGoldFromGoldApiPublic();
    console.log("[rates] Gold source: Gold-API.com");
    return publicGoldApiQuote;
  } catch (error) {
    console.error("[rates] Gold-API.com failed:", error);
  }

  try {
    const coinGeckoQuote = await fetchGoldFromCoinGeckoProxy();
    console.log("[rates] Gold source: CoinGecko XAUT proxy");
    return coinGeckoQuote;
  } catch (error) {
    console.error("[rates] CoinGecko proxy failed:", error);
  }

  return null;
};

const buildMarketLivePayload = async (): Promise<MarketLiveResponse> => {
  const now = Date.now();
  if (marketLiveCache && marketLiveCache.expiresAt > now) {
    return marketLiveCache.payload;
  }

  let goldQuote: GoldQuoteSource | null = null;
  let usdRates: { rates: Record<string, number> };
  let eurRates: { rates: Record<string, number> };

  try {
    goldQuote = await fetchGoldPriceOz();
  } catch (error) {
    console.error("[rates] Gold price fetch failed:", error);
    goldQuote = null;
  }

  try {
    console.log("[rates] Fetching USD rates from open.er-api...");
    usdRates = await fetchJson<{ rates: Record<string, number> }>("https://open.er-api.com/v6/latest/USD");
    console.log("[rates] USD rates fetched");
  } catch (error) {
    console.error("[rates] USD rates fetch failed, using DB fallback:", error);
    throw error; // Se não conseguir câmbio, temos que usar fallback do banco
  }

  try {
    console.log("[rates] Fetching EUR rates from open.er-api...");
    eurRates = await fetchJson<{ rates: Record<string, number> }>("https://open.er-api.com/v6/latest/EUR");
    console.log("[rates] EUR rates fetched");
  } catch (error) {
    console.error("[rates] EUR rates fetch failed, using DB fallback:", error);
    throw error;
  }

  const usdToSrdRaw = usdRates.rates?.SRD;
  const eurToUsdRaw = eurRates.rates?.USD;

  if (usdToSrdRaw === undefined || usdToSrdRaw === null) {
    throw new Error("Invalid USD/SRD quote");
  }

  if (eurToUsdRaw === undefined || eurToUsdRaw === null) {
    throw new Error("Invalid EUR/USD quote");
  }

  const usdToSrd = D(usdToSrdRaw);
  const eurToUsd = D(eurToUsdRaw);

  if (usdToSrd.lte(0)) {
    throw new Error("Invalid USD/SRD quote");
  }

  if (eurToUsd.lte(0)) {
    throw new Error("Invalid EUR/USD quote");
  }

  if (!goldQuote) {
    console.warn("[rates] Gold quote unavailable, using database value");
    const latest = await prisma.dailyRate.findFirst({
      orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }]
    });

    if (!latest) {
      throw new Error("No gold price available and no database fallback");
    }

    goldQuote = {
      priceOz: D(latest.goldPricePerGramUsd).mul(OUNCE_IN_GRAMS),
      sourceMode: "database-cached",
      source: {
        symbol: "XAU/USD",
        provider: "Base local",
        url: "/api/rates/latest",
        note: "Fallback: ultima taxa cadastrada"
      }
    };
  }

  const closePriceOz = goldQuote.priceOz;

  if (closePriceOz.lte(0)) {
    throw new Error("Invalid gold price");
  }

  const payload: MarketLiveResponse = {
    rateDate: new Date().toISOString(),
    goldPricePerGramUsd: round4(closePriceOz.div(OUNCE_IN_GRAMS)),
    usdToSrdRate: round4(usdToSrd),
    eurToUsdRate: round4(eurToUsd),
    fetchedAt: new Date().toISOString(),
    sourceMode: goldQuote.sourceMode,
    sources: [
      goldQuote.source,
      {
        symbol: "USD/SRD",
        provider: "ExchangeRate-API",
        url: "https://open.er-api.com/v6/latest/USD",
        note: "Taxas em tempo real"
      },
      {
        symbol: "EUR/USD",
        provider: "ExchangeRate-API",
        url: "https://open.er-api.com/v6/latest/EUR",
        note: "Taxas em tempo real"
      }
    ]
  };

  marketLiveCache = {
    expiresAt: now + LIVE_CACHE_TTL_MS,
    payload
  };

  return payload;
};

router.post("/", async (req: Request, res: Response) => {
  try {
    const payload = createRateSchema.parse(req.body);
    assertPositiveDecimal(payload.goldPricePerGramUsd, "goldPricePerGramUsd", "Preco do ouro por grama em USD");
    assertPositiveDecimal(payload.usdToSrdRate, "usdToSrdRate", "Taxa USD para SRD");
    assertPositiveDecimal(payload.eurToUsdRate, "eurToUsdRate", "Taxa EUR para USD");

    const [operator, existingRate] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.createdById } }),
      prisma.dailyRate.findUnique({ where: { rateDate: new Date(payload.rateDate) } })
    ]);

    if (!operator || operator.status !== RecordStatus.ACTIVE) {
      throw new DomainError("Operador invalido ou inativo.", 422, {
        code: "OPERATOR_INVALID",
        fieldErrors: { createdById: "Operador invalido ou inativo." }
      });
    }

    if (existingRate) {
      throw new DomainError("Ja existe taxa cadastrada para esta data.", 409, {
        code: "RATE_DATE_DUPLICATE",
        fieldErrors: { rateDate: "Ja existe taxa para esta data." }
      });
    }

    const created = await prisma.dailyRate.create({
      data: {
        rateDate: new Date(payload.rateDate),
        createdById: payload.createdById,
        goldPricePerGramUsd: payload.goldPricePerGramUsd,
        usdToSrdRate: payload.usdToSrdRate,
        eurToUsdRate: payload.eurToUsdRate
      }
    });

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

    return res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }
});

router.get("/latest", async (_req: Request, res: Response) => {
  const latest = await prisma.dailyRate.findFirst({
    orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }]
  });

  if (!latest) {
    return res.status(404).json({
      message: "No DailyRate configured.",
      code: "RATE_NOT_FOUND",
      fieldErrors: {}
    });
  }

  return res.json(latest);
});

router.get("/market-live", async (_req: Request, res: Response) => {
  try {
    const payload = await buildMarketLivePayload();
    return res.json(payload);
  } catch (error) {
    console.error("[rates] buildMarketLivePayload failed, returning database fallback:", error);
    
    const latest = await prisma.dailyRate.findFirst({
      orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }]
    });

    if (!latest) {
      return res.status(503).json({
        message: "Nao foi possivel obter cotacoes. Nenhuma taxa local disponivel.",
        code: "MARKET_LIVE_UNAVAILABLE",
        fieldErrors: {}
      });
    }

    const fallbackPayload: MarketLiveResponse = {
      rateDate: latest.rateDate.toISOString(),
      goldPricePerGramUsd: latest.goldPricePerGramUsd.toString(),
      usdToSrdRate: latest.usdToSrdRate.toString(),
      eurToUsdRate: latest.eurToUsdRate.toString(),
      fetchedAt: new Date().toISOString(),
      sourceMode: "database-cached",
      sources: [
        {
          symbol: "ALL",
          provider: "Base local",
          url: "/api/rates/latest",
          note: "Fallback: última taxa cadastrada (APIs externas indisponíveis)"
        }
      ]
    };

    // Status 200 mas com sourceMode indicando fallback
    return res.json(fallbackPayload);
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

      assertPositiveDecimal(goldPricePerGramUsd, "goldPricePerGramUsd", "Preço do ouro");

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Buscar taxas de câmbio atuais
      let usdToSrdRate = "37.5770";
      let eurToUsdRate = "1.1797";

      try {
        const [usdRates, eurRates] = await Promise.all([
          fetchJson<{ rates: Record<string, number> }>("https://open.er-api.com/v6/latest/USD"),
          fetchJson<{ rates: Record<string, number> }>("https://open.er-api.com/v6/latest/EUR")
        ]);

        usdToSrdRate = D(usdRates.rates?.SRD ?? "37.5770").toFixed(4);
        eurToUsdRate = D(eurRates.rates?.USD ?? "1.1797").toFixed(4);
      } catch (error) {
        console.warn("[rates] Não conseguiu atualizar taxas de câmbio, usando últimas conhecidas");
      }

      // Buscar ou criar operador default
      const defaultOperator = await prisma.user.findFirst({
        where: { role: "OPERATOR", status: "ACTIVE" }
      });

      if (!defaultOperator) {
        return res.status(422).json({
          message: "Nenhum operador ativo encontrado",
          code: "NO_OPERATOR",
          fieldErrors: {}
        });
      }

      const existing = await prisma.dailyRate.findUnique({
        where: { rateDate: today }
      });

      let result;
      if (existing) {
        result = await prisma.dailyRate.update({
          where: { rateDate: today },
          data: {
            goldPricePerGramUsd,
            usdToSrdRate,
            eurToUsdRate
          }
        });
        console.log(`[rates] Taxa de ouro atualizada manualmente para ${goldPricePerGramUsd}/grama`);
      } else {
        result = await prisma.dailyRate.create({
          data: {
            rateDate: today,
            createdById: defaultOperator.id,
            goldPricePerGramUsd,
            usdToSrdRate,
            eurToUsdRate
          }
        });
        console.log(`[rates] Taxa de ouro criada manualmente: ${goldPricePerGramUsd}/grama`);
      }

      // Limpar cache para forçar busca de novos dados
      marketLiveCache = null;

      return res.json({
        message: "Preço do ouro atualizado com sucesso",
        data: {
          goldPricePerGramUsd: result.goldPricePerGramUsd.toString(),
          usdToSrdRate: result.usdToSrdRate.toString(),
          eurToUsdRate: result.eurToUsdRate.toString(),
          rateDate: result.rateDate.toISOString()
        }
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

      return res.status(500).json({
        message: "Erro ao atualizar preço do ouro",
        code: "INTERNAL_SERVER_ERROR",
        fieldErrors: {}
      });
    }
  }
);

export { router as ratesRouter };
