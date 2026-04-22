import { Decimal } from "decimal.js";

import { D, q4 } from "../lib/decimal.js";
import { getMarketLiveCache, setMarketLiveCache } from "./market-live-cache.js";
import { fetchGoldPriceOz, MarketSource, measureFetchJson } from "./market-rates-provider.js";

const OUNCE_IN_GRAMS = 31.1035;
const LIVE_CACHE_TTL_MS = 30 * 1000;

export type MarketLiveResponse = {
  rateDate: string;
  goldPricePerGramUsd: string;
  usdToSrdRate: string;
  eurToUsdRate: string;
  fetchedAt: string;
  sourceMode: "external-live";
  lastUpdatedBy?: string;
  sources: MarketSource[];
};

const round4 = (value: Decimal.Value) => q4(value).toFixed(4);

export const buildMarketLivePayload = async (): Promise<MarketLiveResponse> => {
  const now = Date.now();
  const cached = getMarketLiveCache<MarketLiveResponse>();
  if (cached && cached.expiresAt > now) {
    return cached.payload;
  }

  let goldQuote = null;
  let usdRates: { rates: Record<string, number> };
  let eurRates: { rates: Record<string, number> };
  let usdRatesFetchedAt = "";
  let eurRatesFetchedAt = "";
  let usdRatesLatencyMs = 0;
  let eurRatesLatencyMs = 0;

  try {
    goldQuote = await fetchGoldPriceOz();
  } catch (error) {
    console.error("[rates] Gold price fetch failed:", error);
    goldQuote = null;
  }

  try {
    console.log("[rates] Fetching USD rates from open.er-api...");
    const usdRatesResponse = await measureFetchJson<{ rates: Record<string, number> }>("https://open.er-api.com/v6/latest/USD");
    usdRates = usdRatesResponse.data;
    usdRatesFetchedAt = usdRatesResponse.fetchedAt;
    usdRatesLatencyMs = usdRatesResponse.latencyMs;
    console.log("[rates] USD rates fetched");
  } catch (error) {
    console.error("[rates] USD rates fetch failed:", error);
    throw error;
  }

  try {
    console.log("[rates] Fetching EUR rates from open.er-api...");
    const eurRatesResponse = await measureFetchJson<{ rates: Record<string, number> }>("https://open.er-api.com/v6/latest/EUR");
    eurRates = eurRatesResponse.data;
    eurRatesFetchedAt = eurRatesResponse.fetchedAt;
    eurRatesLatencyMs = eurRatesResponse.latencyMs;
    console.log("[rates] EUR rates fetched");
  } catch (error) {
    console.error("[rates] EUR rates fetch failed:", error);
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
    throw new Error("No live gold quote available");
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
        note: "Taxas em tempo real",
        fetchedAt: usdRatesFetchedAt,
        latencyMs: usdRatesLatencyMs
      },
      {
        symbol: "EUR/USD",
        provider: "ExchangeRate-API",
        url: "https://open.er-api.com/v6/latest/EUR",
        note: "Taxas em tempo real",
        fetchedAt: eurRatesFetchedAt,
        latencyMs: eurRatesLatencyMs
      }
    ]
  };

  console.info(
    "[rates][audit] market-live",
    JSON.stringify({
      fetchedAt: payload.fetchedAt,
      goldPricePerGramUsd: payload.goldPricePerGramUsd,
      usdToSrdRate: payload.usdToSrdRate,
      eurToUsdRate: payload.eurToUsdRate,
      sources: payload.sources.map((source) => ({
        symbol: source.symbol,
        provider: source.provider,
        fetchedAt: source.fetchedAt,
        latencyMs: source.latencyMs
      }))
    })
  );

  setMarketLiveCache({
    expiresAt: now + LIVE_CACHE_TTL_MS,
    payload
  });

  return payload;
};
