import type { DailyRate } from "@/components/shell/useMarketLiveFeed";

export type MarketPoint = {
  time: string;
  value: number;
};

export type MarketAsset = {
  symbol: string;
  name: string;
  price: string;
  delta: string;
  percent: string;
  trend: "up" | "down";
  accent: string;
  glow: string;
  history: MarketPoint[];
};

const HOURS = Array.from({ length: 24 }, (_, hour) => `${hour.toString().padStart(2, "0")}h`);

const formatPrice = (value: number, digits: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const buildHistory = (current: number, dayMovePercent: number): MarketPoint[] => {
  const safeMovePercent = Number.isFinite(dayMovePercent) ? dayMovePercent : 0;
  const origin = current / (1 + safeMovePercent / 100);

  return HOURS.map((time, index) => {
    if (index === HOURS.length - 1) {
      return {
        time,
        value: Number(current.toFixed(6))
      };
    }

    const progress = index / (HOURS.length - 1);
    const drift = 1 + (safeMovePercent / 100) * progress;
    const wave = 1 + Math.sin(progress * Math.PI * 2) * 0.006;

    return {
      time,
      value: Number((origin * drift * wave).toFixed(6))
    };
  });
};

export const toMarketAssets = (rate: DailyRate | null): MarketAsset[] => {
  if (!rate) {
    return [];
  }

  const goldGram = Number(rate.goldPricePerGramUsd);
  const goldOz = Number(rate.goldPricePerGramUsd) * 31.1035;
  const referenceGram = goldGram * 0.9;
  const usdSrd = Number(rate.usdToSrdRate);
  const eurUsd = Number(rate.eurToUsdRate);
  const usdBrl = Number((usdSrd / 7.35).toFixed(4));

  const live = [
    {
      symbol: "GRAM-REF/USD",
      name: "Grama Referencia",
      current: referenceGram,
      move: 0.78,
      accent: "#f59e0b",
      glow: "from-amber-300/20 to-transparent",
      digits: 4
    },
    {
      symbol: "XAU/USD",
      name: "Gold Spot",
      current: goldOz,
      move: 0.78,
      accent: "#f5b942",
      glow: "from-amber-300/20 to-transparent",
      digits: 2
    },
    {
      symbol: "USD/BRL",
      name: "Dollar Real",
      current: usdBrl,
      move: -0.32,
      accent: "#ef4444",
      glow: "from-rose-300/20 to-transparent",
      digits: 4
    },
    {
      symbol: "EUR/USD",
      name: "Euro Dollar",
      current: eurUsd,
      move: 0.41,
      accent: "#22c55e",
      glow: "from-emerald-300/20 to-transparent",
      digits: 4
    },
    {
      symbol: "USD/SRD",
      name: "Dollar Suriname",
      current: usdSrd,
      move: 0.26,
      accent: "#38bdf8",
      glow: "from-sky-300/20 to-transparent",
      digits: 4
    }
  ];

  return live.map((asset) => {
    const previous = asset.current / (1 + asset.move / 100);
    const delta = asset.current - previous;

    return {
      symbol: asset.symbol,
      name: asset.name,
      price: formatPrice(asset.current, asset.digits),
      delta: `${delta >= 0 ? "+" : ""}${formatPrice(delta, asset.digits)}`,
      percent: `${asset.move >= 0 ? "+" : ""}${asset.move.toFixed(2)}%`,
      trend: asset.move >= 0 ? "up" : "down",
      accent: asset.accent,
      glow: asset.glow,
      history: buildHistory(asset.current, asset.move)
    };
  });
};
