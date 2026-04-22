import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";

export type DailyRate = {
  rateDate: string;
  goldPricePerGramUsd: string;
  usdToSrdRate: string;
  eurToUsdRate: string;
  fetchedAt?: string;
  sourceMode?: "external-live" | "database-cached" | "manual-input";
  sources?: Array<{
    symbol: string;
    provider: string;
    url: string;
    note: string;
  }>;
};

export const useDailyRate = () => {
  const [rate, setRate] = useState<DailyRate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const latestRate = await apiRequest<DailyRate>("/rates/market-live", "GET");
        setRate(latestRate);
      } catch {
        setRate(null);
      } finally {
        setLoading(false);
      }
    };

    load().catch(() => setLoading(false));
  }, []);

  return {
    loading,
    rate
  };
};
