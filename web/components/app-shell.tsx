"use client";

import * as React from "react";
import type { ReactNode } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MarketCard } from "@/components/shell/MarketCard";
import { RightMarketRail } from "@/components/shell/RightMarketRail";
import { toMarketAssets } from "@/components/shell/market-assets";
import { useMarketLiveFeed } from "@/components/shell/useMarketLiveFeed";
import { useAuthStore } from "@/lib/auth-store";
import {
  BadgeDollarSign,
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
  Settings,
  UserRound,
  Users
} from "lucide-react";

const navigation = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dash", icon: LayoutDashboard },
  { href: "/compra", label: "Compra", shortLabel: "Buy", icon: BadgeDollarSign },
  { href: "/venda", label: "Venda", shortLabel: "Sell", icon: CircleDollarSign },
  { href: "/extrato", label: "Extrato", shortLabel: "Book", icon: BookOpenText },
  { href: "/tesouraria", label: "Tesouraria", shortLabel: "FX", icon: Landmark },
  { href: "/clientes", label: "Clientes", shortLabel: "Cli", icon: Users },
  { href: "/fornecedores", label: "Fornecedores", shortLabel: "Sup", icon: Building2 },
  { href: "/perfil", label: "Perfil", shortLabel: "User", icon: UserRound },
  { href: "/configuracoes", label: "Configuracoes", shortLabel: "Cfg", icon: Settings }
] as const;

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Painel Operacional", subtitle: "Visao consolidada do caixa e mercado" },
  "/compra": { title: "Mesa de Compra", subtitle: "Fluxo institucional de aquisicao no balcao" },
  "/venda": { title: "Mesa de Venda", subtitle: "Execucao comercial com split multimoeda" },
  "/extrato": { title: "Extrato", subtitle: "Ledger cronologico e resultado operacional" },
  "/tesouraria": { title: "Tesouraria", subtitle: "Extrato gerencial, cofre e lucratividade" },
  "/clientes": { title: "Clientes", subtitle: "Cadastro e relacionamento com vendedores" },
  "/fornecedores": { title: "Fornecedores", subtitle: "Cadastro institucional de compradores" },
  "/perfil": { title: "Perfil", subtitle: "Dados do operador, credenciais e identidade" },
  "/configuracoes": { title: "Configuracoes", subtitle: "Preferencias operacionais e seguranca" }
};

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

  const { latestRate, marketLoading, lastSyncLabel, marketSources, sourceMode } = useMarketLiveFeed({
    isEnabled: !isLoginRoute && auth.isAuthenticated
  });

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
                    {usingMockRates ? "Mercado indisponivel (sem mock)" : "Mercado em dados reais"}
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
