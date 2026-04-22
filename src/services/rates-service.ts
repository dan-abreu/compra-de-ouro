import { PrismaClient, RecordStatus } from "@prisma/client";

import { D } from "../lib/decimal.js";
import { DomainError, isPrismaMissingColumnError } from "../lib/errors.js";
import { ensureTenantSchemaForTrading } from "../lib/tenant-schema-repair.js";
import { clearMarketLiveCache } from "./market-live-cache.js";
import { fetchJson } from "./market-rates-provider.js";

export type CreateDailyRateInput = {
  rateDate: string;
  createdById: string;
  goldPricePerGramUsd: string;
  usdToSrdRate: string;
  eurToUsdRate: string;
};

const assertPositiveDecimal = (value: string, field: string, label: string) => {
  if (D(value).lte(0)) {
    throw new DomainError(`${label} deve ser maior que zero.`, 422, {
      code: "VALIDATION_ERROR",
      fieldErrors: { [field]: `${label} deve ser maior que zero.` }
    });
  }
};

export const getLatestRateWithSchemaRepair = async (prisma: PrismaClient) => {
  try {
    return await prisma.dailyRate.findFirst({
      orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }]
    });
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) {
      throw error;
    }

    await ensureTenantSchemaForTrading(prisma);
    return prisma.dailyRate.findFirst({
      orderBy: [{ rateDate: "desc" }, { createdAt: "desc" }]
    });
  }
};

export const createDailyRate = async (prisma: PrismaClient, input: CreateDailyRateInput) => {
  assertPositiveDecimal(input.goldPricePerGramUsd, "goldPricePerGramUsd", "Preco do ouro por grama em USD");
  assertPositiveDecimal(input.usdToSrdRate, "usdToSrdRate", "Taxa USD para SRD");
  assertPositiveDecimal(input.eurToUsdRate, "eurToUsdRate", "Taxa EUR para USD");

  const [operator, existingRate] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.createdById } }),
    prisma.dailyRate.findUnique({ where: { rateDate: new Date(input.rateDate) } })
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

  return prisma.dailyRate.create({
    data: {
      rateDate: new Date(input.rateDate),
      createdById: input.createdById,
      goldPricePerGramUsd: input.goldPricePerGramUsd,
      usdToSrdRate: input.usdToSrdRate,
      eurToUsdRate: input.eurToUsdRate
    }
  });
};

export const upsertManualGoldPrice = async (prisma: PrismaClient, goldPricePerGramUsd: string) => {
  assertPositiveDecimal(goldPricePerGramUsd, "goldPricePerGramUsd", "Preco do ouro");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let usdToSrdRate = "37.5770";
  let eurToUsdRate = "1.1797";

  try {
    const [usdRates, eurRates] = await Promise.all([
      fetchJson<{ rates: Record<string, number> }>("https://open.er-api.com/v6/latest/USD"),
      fetchJson<{ rates: Record<string, number> }>("https://open.er-api.com/v6/latest/EUR")
    ]);

    usdToSrdRate = D(usdRates.rates?.SRD ?? "37.5770").toFixed(4);
    eurToUsdRate = D(eurRates.rates?.USD ?? "1.1797").toFixed(4);
  } catch {
    // Keep last-known fallback FX when external provider is unavailable.
  }

  const defaultOperator = await prisma.user.findFirst({
    where: { role: "OPERATOR", status: "ACTIVE" }
  });

  if (!defaultOperator) {
    throw new DomainError("Nenhum operador ativo encontrado", 422, {
      code: "NO_OPERATOR",
      fieldErrors: {}
    });
  }

  const existing = await prisma.dailyRate.findUnique({
    where: { rateDate: today }
  });

  const result = existing
    ? await prisma.dailyRate.update({
      where: { rateDate: today },
      data: {
        goldPricePerGramUsd,
        usdToSrdRate,
        eurToUsdRate
      }
    })
    : await prisma.dailyRate.create({
      data: {
        rateDate: today,
        createdById: defaultOperator.id,
        goldPricePerGramUsd,
        usdToSrdRate,
        eurToUsdRate
      }
    });

  clearMarketLiveCache();

  return {
    goldPricePerGramUsd: result.goldPricePerGramUsd.toString(),
    usdToSrdRate: result.usdToSrdRate.toString(),
    eurToUsdRate: result.eurToUsdRate.toString(),
    rateDate: result.rateDate.toISOString()
  };
};