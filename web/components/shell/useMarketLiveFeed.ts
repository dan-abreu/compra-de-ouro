import * as React from "react";

import { apiRequest } from "@/lib/apiClient";

export type DailyRate = {
  rateDate: string;
  goldPricePerGramUsd: string;
  usdToSrdRate: string;
  eurToUsdRate: string;
  fetchedAt?: string;
  sourceMode?: "external-live";
  sources?: Array<{
    symbol: string;
    provider: string;
    url: string;
    note: string;
    fetchedAt?: string;
    latencyMs?: number;
  }>;
};

export const useMarketLiveFeed = ({
  isEnabled,
  refreshMs = 30_000
}: {
  isEnabled: boolean;
  refreshMs?: number;
}) => {
  const [latestRate, setLatestRate] = React.useState<DailyRate | null>(null);
  const [marketLoading, setMarketLoading] = React.useState(true);
  const [lastSyncLabel, setLastSyncLabel] = React.useState("-");
  const [marketSources, setMarketSources] = React.useState<DailyRate["sources"]>([]);
  const [sourceMode, setSourceMode] = React.useState<"external-live">("external-live");

  React.useEffect(() => {
    if (!isEnabled) {
      setLatestRate(null);
      setMarketSources([]);
      setLastSyncLabel("-");
      setMarketLoading(false);
      return;
    }

    let active = true;

    const loadLatestRate = async () => {
      try {
        setMarketLoading(true);
        const rate = await apiRequest<DailyRate>("/rates/market-live", "GET");
        if (!active) {
          return;
        }
        setLatestRate(rate);
        setMarketSources(rate.sources ?? []);
        setSourceMode(rate.sourceMode ?? "external-live");
        setLastSyncLabel(new Date(rate.fetchedAt ?? Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      } catch {
        if (!active) {
          return;
        }
        setLatestRate(null);
        setMarketSources([]);
        setLastSyncLabel("offline");
      } finally {
        if (active) {
          setMarketLoading(false);
        }
      }
    };

    loadLatestRate().catch(() => {
      setLatestRate(null);
      setMarketSources([]);
      setLastSyncLabel("offline");
      setMarketLoading(false);
    });

    const timer = window.setInterval(() => {
      loadLatestRate().catch(() => {
        setLatestRate(null);
        setMarketSources([]);
        setLastSyncLabel("offline");
        setMarketLoading(false);
      });
    }, refreshMs);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isEnabled, refreshMs]);

  return {
    latestRate,
    marketLoading,
    lastSyncLabel,
    marketSources,
    sourceMode
  };
};
