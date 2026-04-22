import { BarChart3 } from "lucide-react";

import type { DailyRate } from "@/components/shell/useMarketLiveFeed";
import type { MarketAsset } from "./market-assets";
import { MarketCard } from "./MarketCard";

type RightMarketRailProps = {
  expanded: boolean;
  assets: MarketAsset[];
  loading: boolean;
  lastSyncLabel: string;
  usingMockRates: boolean;
  sourceMode: DailyRate["sourceMode"];
  sources: NonNullable<DailyRate["sources"]>;
  xauUsdSpot: number | null;
  referenceGramUsd: number | null;
};

export function RightMarketRail({
  expanded,
  assets,
  loading,
  lastSyncLabel,
  usingMockRates,
  sourceMode,
  sources,
  xauUsdSpot,
  referenceGramUsd
}: RightMarketRailProps) {
  return (
    <aside
      className={`fixed bottom-4 right-4 top-4 z-40 overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/95 shadow-[0_30px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl transition-all duration-300 ${expanded ? "w-[25rem]" : "w-36"}`}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 px-4 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className={`transition-all duration-300 ${expanded ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Live watchlist</p>
              <p className="font-heading text-lg font-semibold">Mercado 24h</p>
              <p className="mt-1 text-xs text-slate-500">{loading ? "Atualizando taxas..." : `Sincronizado: ${lastSyncLabel}`}</p>
              <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${usingMockRates ? "bg-rose-300/15 text-rose-200" : "bg-emerald-300/15 text-emerald-200"}`}>
                {usingMockRates ? "Feed indisponivel" : "Dados reais da API"}
              </div>
              {!usingMockRates ? (
                <div className="mt-2 inline-flex rounded-full bg-sky-300/15 px-2.5 py-1 text-[11px] font-semibold text-sky-200">
                  {sourceMode === "external-live" ? "Fonte externa ao vivo" : "Fonte externa"}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {expanded ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
              {usingMockRates ? (
                <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 px-3 py-3 text-rose-100">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-rose-200/90">Mercado indisponivel</p>
                  <p className="mt-1 text-sm">Sem dados ao vivo no momento. Nao exibimos valores simulados.</p>
                </div>
              ) : null}
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-3 py-3 text-amber-100">
                <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/90">Referencia da grama</p>
                <p className="mt-1 text-lg font-semibold">
                  {referenceGramUsd !== null ? `USD ${referenceGramUsd.toFixed(4)}` : "-"}
                </p>
                <p className="mt-1 text-[11px] text-amber-100/80">
                  Formula: (XAU/USD {xauUsdSpot !== null ? xauUsdSpot.toFixed(2) : "-"} / 31.1035) - 10%
                </p>
                <p className="mt-1 text-[11px] text-amber-100/70">Uso: valor de referencia para negociar; preco da ordem continua manual.</p>
              </div>

              {assets.map((asset) => (
                <MarketCard key={asset.symbol} asset={asset} expanded={expanded} />
              ))}
            </div>
            <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-300">
              <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">Fontes das cotacoes</p>
              <div className="space-y-2">
                {sources.map((source) => (
                  <div key={`${source.symbol}-${source.url}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="font-semibold text-slate-100">{source.symbol} · {source.provider}</p>
                    <p className="mt-0.5 text-slate-400">{source.note}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {source.fetchedAt ? `Atualizado: ${new Date(source.fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Atualizado: -"}
                      {typeof source.latencyMs === "number" ? ` · Latencia: ${source.latencyMs}ms` : " · Latencia: -"}
                    </p>
                    <a className="mt-1 inline-block text-sky-300 hover:text-sky-200" href={source.url} target="_blank" rel="noreferrer">
                      {source.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
            <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-2.5 py-2 text-amber-100">
              <p className="text-[10px] uppercase tracking-[0.14em] text-amber-200/90">Grama ref.</p>
              <p className="mt-1 text-sm font-semibold leading-none">{referenceGramUsd !== null ? referenceGramUsd.toFixed(4) : "-"}</p>
            </div>

            {assets.map((asset) => (
              <div key={asset.symbol} className="rounded-xl border border-white/10 bg-slate-900/80 px-2.5 py-2 text-white">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{asset.symbol}</p>
                <p className="mt-1 text-sm font-semibold leading-none">{asset.price}</p>
                <p className={`mt-1 text-[11px] ${asset.trend === "up" ? "text-emerald-300" : "text-rose-300"}`}>{asset.percent}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
