"use client";

import * as React from "react";
import type { ReactNode } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { apiRequest } from "@/lib/apiClient";
import { useAuthStore } from "@/lib/auth-store";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  BadgeDollarSign,
  BarChart3,
  Bell,
  BookOpenText,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  Gem,
  Landmark,
  LayoutDashboard,
  Menu,
  TrendingDown,
  TrendingUp,
  Users
} from "lucide-react";

const navigation = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dash", icon: LayoutDashboard },
  { href: "/compra", label: "Compra", shortLabel: "Buy", icon: BadgeDollarSign },
  { href: "/venda", label: "Venda", shortLabel: "Sell", icon: CircleDollarSign },
  { href: "/extrato", label: "Extrato", shortLabel: "Book", icon: BookOpenText },
  { href: "/tesouraria", label: "Tesouraria", shortLabel: "FX", icon: Landmark },
  { href: "/clientes", label: "Clientes", shortLabel: "Cli", icon: Users },
  { href: "/fornecedores", label: "Fornecedores", shortLabel: "Sup", icon: Building2 }
] as const;

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Painel Operacional", subtitle: "Visao consolidada do caixa e mercado" },
  "/compra": { title: "Mesa de Compra", subtitle: "Fluxo institucional de aquisicao no balcao" },
  "/venda": { title: "Mesa de Venda", subtitle: "Execucao comercial com split multimoeda" },
  "/extrato": { title: "Extrato", subtitle: "Ledger cronologico e resultado operacional" },
  "/tesouraria": { title: "Tesouraria", subtitle: "Extrato gerencial, cofre e lucratividade" },
  "/clientes": { title: "Clientes", subtitle: "Cadastro e relacionamento com vendedores" },
  "/fornecedores": { title: "Fornecedores", subtitle: "Cadastro institucional de compradores" }
};

type MarketPoint = {
  time: string;
  value: number;
};

type DailyRate = {
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

type MarketAsset = {
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

const marketAssets: MarketAsset[] = [
  {
    symbol: "XAU/USD",
    name: "Gold Spot",
    price: "2,384.72",
    delta: "+18.41",
    percent: "+0.78%",
    trend: "up",
    accent: "#f5b942",
    glow: "from-amber-300/20 to-transparent",
    history: [
      { time: "00h", value: 2340 },
      { time: "03h", value: 2348 },
      { time: "06h", value: 2354 },
      { time: "09h", value: 2362 },
      { time: "12h", value: 2356 },
      { time: "15h", value: 2368 },
      { time: "18h", value: 2376 },
      { time: "21h", value: 2384 }
    ]
  },
  {
    symbol: "USD/BRL",
    name: "Dollar Real",
    price: "5.1824",
    delta: "-0.0321",
    percent: "-0.62%",
    trend: "down",
    accent: "#ef4444",
    glow: "from-rose-300/20 to-transparent",
    history: [
      { time: "00h", value: 5.24 },
      { time: "03h", value: 5.23 },
      { time: "06h", value: 5.22 },
      { time: "09h", value: 5.2 },
      { time: "12h", value: 5.19 },
      { time: "15h", value: 5.18 },
      { time: "18h", value: 5.17 },
      { time: "21h", value: 5.1824 }
    ]
  },
  {
    symbol: "EUR/USD",
    name: "Euro Dollar",
    price: "1.0831",
    delta: "+0.0047",
    percent: "+0.44%",
    trend: "up",
    accent: "#22c55e",
    glow: "from-emerald-300/20 to-transparent",
    history: [
      { time: "00h", value: 1.071 },
      { time: "03h", value: 1.074 },
      { time: "06h", value: 1.076 },
      { time: "09h", value: 1.078 },
      { time: "12h", value: 1.08 },
      { time: "15h", value: 1.079 },
      { time: "18h", value: 1.081 },
      { time: "21h", value: 1.0831 }
    ]
  },
  {
    symbol: "USD/SRD",
    name: "Dollar Suriname",
    price: "38.2000",
    delta: "+0.1200",
    percent: "+0.31%",
    trend: "up",
    accent: "#38bdf8",
    glow: "from-sky-300/20 to-transparent",
    history: [
      { time: "00h", value: 37.82 },
      { time: "03h", value: 37.88 },
      { time: "06h", value: 37.95 },
      { time: "09h", value: 38.01 },
      { time: "12h", value: 38.08 },
      { time: "15h", value: 38.12 },
      { time: "18h", value: 38.16 },
      { time: "21h", value: 38.2 }
    ]
  }
];

const getShellMetrics = (isDesktop: boolean, leftExpanded: boolean, rightExpanded: boolean) => {
  if (!isDesktop) {
    return {
      left: 12,
      right: 12,
      leftExpanded: 256,
      rightExpanded: 320,
      top: 12,
      bottom: 12
    };
  }

  return {
    left: leftExpanded ? 308 : 100,
    right: rightExpanded ? 420 : 116,
    leftExpanded: 308,
    rightExpanded: 420,
    top: 24,
    bottom: 24
  };
};

const usePageMeta = (pathname: string) => {
  const entry = Object.entries(pageTitles).find(([route]) => pathname.startsWith(route));
  return entry?.[1] ?? { title: "Casa de Ouro ERP", subtitle: "Terminal institucional de operacoes" };
};

const formatPrice = (value: number, digits: number) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const HOURS = Array.from({ length: 24 }, (_, hour) => `${hour.toString().padStart(2, "0")}h`);

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

const parseMarketPrice = (value: string) => Number(value.replace(/,/g, ""));
const parsePercentValue = (value: string) => Number(value.replace("%", ""));

const toMarketAssets = (rate: DailyRate | null): MarketAsset[] => {
  if (!rate) {
    const xau = marketAssets.find((asset) => asset.symbol === "XAU/USD");
    const xauSpot = xau ? parseMarketPrice(xau.price) : 0;
    const gramReference = xauSpot > 0 ? (xauSpot / 31.1035) * 0.9 : 0;

    const referenceAsset: MarketAsset = {
      symbol: "GRAM-REF/USD",
      name: "Grama Referencia",
      price: formatPrice(gramReference, 4),
      delta: "+0.0000",
      percent: xau?.percent ?? "+0.00%",
      trend: (xau?.trend ?? "up") as "up" | "down",
      accent: "#f59e0b",
      glow: "from-amber-300/20 to-transparent",
      history: buildHistory(gramReference, parsePercentValue(xau?.percent ?? "+0.00%"))
    };

    const normalizedFallback: MarketAsset[] = marketAssets.map((asset) => ({
      ...asset,
      history: buildHistory(parseMarketPrice(asset.price), parsePercentValue(asset.percent))
    }));

    return [
      referenceAsset,
      ...normalizedFallback
    ];
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

function LeftNavRail({ expanded, pathname }: { expanded: boolean; pathname: string }) {
  return (
    <aside
      className={`fixed bottom-4 left-4 top-4 z-40 flex flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/95 shadow-[0_30px_90px_rgba(2,6,23,0.45)] backdrop-blur-xl transition-all duration-300 ${expanded ? "w-72" : "w-20"}`}
    >
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-200/15">
          <Gem className="h-5 w-5" />
        </div>
        <div className={`min-w-0 transition-all duration-300 ${expanded ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-2 opacity-0"}`}>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Suriname Treasury</p>
          <p className="truncate font-heading text-lg font-semibold text-white">Casa de Ouro ERP</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-4">
        {navigation.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-300 ${
                active
                  ? "bg-gradient-to-r from-amber-400/20 to-amber-300/5 text-white ring-1 ring-amber-300/25"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-amber-300/15 text-amber-200" : "bg-slate-900 text-slate-300 group-hover:bg-slate-800"}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className={`min-w-0 transition-all duration-300 ${expanded ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-2 opacity-0"}`}>
                <p className="truncate text-sm font-semibold">{item.label}</p>
                <p className="truncate text-xs text-slate-500">{item.shortLabel}</p>
              </div>
              <ChevronRight className={`ml-auto h-4 w-4 transition-all duration-300 ${expanded ? "opacity-100" : "opacity-0"}`} />
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-2xl bg-white/5 p-3 text-slate-300">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <Gauge className="h-5 w-5" />
            </div>
            <div className={`transition-all duration-300 ${expanded ? "opacity-100" : "opacity-0"}`}>
              <p className="text-sm font-semibold">Engine status</p>
              <p className="text-xs text-slate-500">Ledger online</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MarketCard({ asset, expanded }: { asset: MarketAsset; expanded: boolean }) {
  const positive = asset.trend === "up";
  const TrendIcon = positive ? TrendingUp : TrendingDown;

  return (
    <div className={`overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-3 text-white transition-all duration-300 ${expanded ? "min-h-[220px]" : "min-h-[112px]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{asset.symbol}</p>
          <p className={`mt-1 font-heading font-semibold ${expanded ? "text-2xl" : "text-lg"}`}>{asset.price}</p>
        </div>
        <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${positive ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {asset.percent}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <div>
          <p className="text-slate-500">24h delta</p>
          <p className={`mt-1 font-semibold ${positive ? "text-emerald-300" : "text-rose-300"}`}>{asset.delta}</p>
        </div>
        <div className={`rounded-full bg-gradient-to-r ${asset.glow} px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300`}>
          Market Feed
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={asset.history} margin={{ top: 10, right: 0, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${asset.symbol.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={asset.accent} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={asset.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="time" interval={0} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 9 }} />
              <YAxis hide domain={["dataMin - 0.05", "dataMax + 0.05"]} />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid rgba(148,163,184,0.18)",
                  borderRadius: "16px",
                  color: "#f8fafc"
                }}
                labelStyle={{ color: "#cbd5e1" }}
              />
              <Area type="monotone" dataKey="value" stroke={asset.accent} strokeWidth={2} fill={`url(#gradient-${asset.symbol.replace(/\W/g, "")})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span>{asset.name}</span>
        <span>24h</span>
      </div>
    </div>
  );
}

function RightMarketRail({
  expanded,
  assets,
  loading,
  lastSyncLabel,
  usingMockRates,
  sourceMode,
  sources,
  xauUsdSpot,
  referenceGramUsd
}: {
  expanded: boolean;
  assets: MarketAsset[];
  loading: boolean;
  lastSyncLabel: string;
  usingMockRates: boolean;
  sourceMode: "external-live" | "database-cached" | "manual-input";
  sources: Array<{
    symbol: string;
    provider: string;
    url: string;
    note: string;
  }>;
  xauUsdSpot: number | null;
  referenceGramUsd: number | null;
}) {
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
              <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${usingMockRates ? "bg-amber-300/15 text-amber-200" : "bg-emerald-300/15 text-emerald-200"}`}>
                {usingMockRates ? "Modo fallback mock" : "Dados reais da API"}
              </div>
              {!usingMockRates ? (
                <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${sourceMode === "external-live" ? "bg-sky-300/15 text-sky-200" : "bg-amber-300/15 text-amber-200"}`}>
                  {sourceMode === "external-live"
                    ? "Fonte externa ao vivo"
                    : sourceMode === "manual-input"
                      ? "Fonte de contingencia"
                      : "Fonte local (fallback)"}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {expanded ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
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

function MobileQuickNav({ pathname }: { pathname: string }) {
  return (
    <nav className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {navigation.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold ${
              active
                ? "border-amber-300 bg-amber-100/60 text-amber-900"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuthStore();
  const [leftExpanded, setLeftExpanded] = React.useState(false);
  const [rightExpanded, setRightExpanded] = React.useState(false);
  const [marketPinnedOpen, setMarketPinnedOpen] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(true);
  const [mobileMarketOpen, setMobileMarketOpen] = React.useState(false);
  const [latestRate, setLatestRate] = React.useState<DailyRate | null>(null);
  const [marketLoading, setMarketLoading] = React.useState(true);
  const [lastSyncLabel, setLastSyncLabel] = React.useState("-");
  const [marketSources, setMarketSources] = React.useState<DailyRate["sources"]>([]);
  const [sourceMode, setSourceMode] = React.useState<"external-live" | "database-cached" | "manual-input">("database-cached");
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const isLoginRoute = pathname.startsWith("/login");
  const requiredRole = pathname.startsWith("/admin") ? "ADMIN" : undefined;

  const STORAGE_KEY = "compra_de_ouro.market_panel_open";

  React.useEffect(() => {
    const updateViewport = () => setIsDesktop(window.innerWidth >= 1024);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = raw === "true";
      setMobileMarketOpen(parsed);
      setMarketPinnedOpen(parsed);
    } catch {
      // Keep default state if storage is unavailable.
    }
  }, []);

  React.useEffect(() => {
    try {
      const value = isDesktop ? marketPinnedOpen : mobileMarketOpen;
      window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    } catch {
      // Ignore persistence failures (e.g. private mode).
    }
  }, [isDesktop, marketPinnedOpen, mobileMarketOpen]);

  React.useEffect(() => {
    if (isLoginRoute || !auth.isAuthenticated) {
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
        setSourceMode(rate.sourceMode ?? "database-cached");
        setLastSyncLabel(new Date(rate.fetchedAt ?? Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      } catch {
        if (!active) {
          return;
        }
        setLatestRate(null);
        setMarketSources([]);
        setLastSyncLabel("mock");
      } finally {
        if (active) {
          setMarketLoading(false);
        }
      }
    };

    loadLatestRate().catch(() => {
      setLatestRate(null);
      setMarketSources([]);
      setLastSyncLabel("mock");
      setMarketLoading(false);
    });

    const timer = window.setInterval(() => {
      loadLatestRate().catch(() => {
        setLatestRate(null);
        setMarketSources([]);
        setLastSyncLabel("mock");
        setMarketLoading(false);
      });
    }, 90_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [auth.isAuthenticated, isLoginRoute]);

  const tenantLabel = auth.tenantName ?? auth.tenantId ?? "-";
  const userLabel = auth.userName ?? "-";

  const meta = usePageMeta(pathname);
  const effectiveRightExpanded = marketPinnedOpen || rightExpanded;
  const metrics = getShellMetrics(isDesktop, leftExpanded, effectiveRightExpanded);
  const liveAssets = React.useMemo(() => toMarketAssets(latestRate), [latestRate]);
  const usingMockRates = !latestRate;
  const xauUsdSpot = React.useMemo(() => (latestRate ? Number(latestRate.goldPricePerGramUsd) * 31.1035 : null), [latestRate]);
  const referenceGramUsd = React.useMemo(() => {
    if (!latestRate) {
      return null;
    }
    const gramFromSpot = Number(latestRate.goldPricePerGramUsd);
    return gramFromSpot * 0.9;
  }, [latestRate]);

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (isDesktop) {
      return;
    }
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (isDesktop || !touchStartRef.current) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) < 64 || Math.abs(deltaY) > 48) {
      return;
    }

    if (deltaX > 0) {
      setMobileMarketOpen(true);
      return;
    }

    setMobileMarketOpen(false);
  };

  if (isLoginRoute) {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute requiredRole={requiredRole}>
      <div className="relative h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(245,184,66,0.08),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.08),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:32px_32px]" />

      {isDesktop ? (
        <>
          <div onMouseEnter={() => setLeftExpanded(true)} onMouseLeave={() => setLeftExpanded(false)}>
            <LeftNavRail expanded={leftExpanded} pathname={pathname} />
          </div>

          <div onMouseEnter={() => setRightExpanded(true)} onMouseLeave={() => setRightExpanded(false)}>
            <RightMarketRail
              expanded={effectiveRightExpanded}
              assets={liveAssets}
              loading={marketLoading}
              lastSyncLabel={lastSyncLabel}
              usingMockRates={usingMockRates}
              sourceMode={sourceMode}
              sources={marketSources ?? []}
              xauUsdSpot={xauUsdSpot}
              referenceGramUsd={referenceGramUsd}
            />
          </div>
        </>
      ) : null}

      <section
        className={`absolute overflow-hidden border border-white/40 bg-slate-50 shadow-[0_30px_120px_rgba(15,23,42,0.28)] transition-all duration-300 ${isDesktop ? "rounded-[30px]" : "rounded-[22px]"}`}
        style={{
          top: `${metrics.top}px`,
          bottom: `${metrics.bottom}px`,
          left: `${metrics.left}px`,
          right: `${metrics.right}px`
        }}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <header className="border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">Institutional dealing desk</p>
                <h1 className="mt-1 font-heading text-2xl font-semibold text-slate-950">{meta.title}</h1>
                <p className="mt-1 text-sm text-slate-500">{meta.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600">
                  <span className="font-semibold text-slate-900">Loja:</span> {tenantLabel}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600">
                  <span className="font-semibold text-slate-900">Operador:</span> {userLabel}
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                  <span className="font-semibold">Perfil:</span> {auth.role ?? "-"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    auth.clearAuthSession();
                    router.replace("/login");
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700"
                >
                  Sair
                </button>
                {!isDesktop ? (
                  <button
                    type="button"
                    onClick={() => setMobileMarketOpen((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700"
                  >
                    {mobileMarketOpen ? <Menu className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    Mercado
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMarketPinnedOpen((current) => !current)}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 ${marketPinnedOpen ? "border-amber-300 bg-amber-100 text-amber-900" : "border-slate-200 bg-white text-slate-700"}`}
                  >
                    {marketPinnedOpen ? <Menu className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    Mercado
                  </button>
                )}
              </div>
            </div>
          </header>

          <main
            className="institutional-scroll flex-1 overflow-y-auto bg-slate-50 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="mx-auto w-full max-w-[1480px] animate-rise">
              {!isDesktop ? (
                <>
                  <MobileQuickNav pathname={pathname} />
                  <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${usingMockRates ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {usingMockRates ? "Mercado em fallback mock" : "Mercado em dados reais"}
                  </div>
                  {mobileMarketOpen ? (
                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      {liveAssets.map((asset) => (
                        <div key={asset.symbol}>
                          <MarketCard asset={asset} expanded={false} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
              {children}
            </div>
          </main>
        </div>
      </section>
    </div>
    </ProtectedRoute>
  );
}
