import { Decimal } from "decimal.js";

import { D } from "../lib/decimal.js";

export type MarketSource = {
  symbol: string;
  provider: string;
  url: string;
  note: string;
  fetchedAt: string;
  latencyMs: number;
};

export type GoldQuoteSource = {
  priceOz: Decimal;
  source: MarketSource;
  sourceMode: "external-live";
};

export const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
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

export const measureFetchJson = async <T>(url: string, init?: RequestInit): Promise<{ data: T; fetchedAt: string; latencyMs: number }> => {
  const startedAt = Date.now();
  const data = await fetchJson<T>(url, init);
  const finishedAt = Date.now();

  return {
    data,
    fetchedAt: new Date(finishedAt).toISOString(),
    latencyMs: finishedAt - startedAt
  };
};

const fetchGoldFromGoldApiPublic = async (): Promise<GoldQuoteSource> => {
  const quoteResponse = await measureFetchJson<{ price?: number }>("https://api.gold-api.com/price/XAU/USD");
  const quote = quoteResponse.data;

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
      note: "Spot XAU/USD sem chave",
      fetchedAt: quoteResponse.fetchedAt,
      latencyMs: quoteResponse.latencyMs
    }
  };
};

const fetchGoldFromCoinGeckoProxy = async (): Promise<GoldQuoteSource> => {
  const quoteResponse = await measureFetchJson<{ "tether-gold"?: { usd?: number } }>(
    "https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd"
  );
  const quote = quoteResponse.data;

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
      note: "Proxy de mercado para ouro spot (token lastreado em ouro)",
      fetchedAt: quoteResponse.fetchedAt,
      latencyMs: quoteResponse.latencyMs
    }
  };
};

export const fetchGoldPriceOz = async (): Promise<GoldQuoteSource | null> => {
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
