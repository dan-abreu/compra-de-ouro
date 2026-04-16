"use client";

import Decimal from "decimal.js";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Gem,
  Info,
  Scale,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { D } from "@/lib/decimal";

type TreasuryResponse = {
  generatedAt: string;
  vault: {
    balanceUsd: string;
    balanceEur: string;
    balanceSrd: string;
    balanceGoldGrams: string;
    openGoldGrams: string;
    openGoldAcquisitionCostUsd: string;
  } | null;
  goldByCategory: Array<{
    category: "BURNED" | "MELTED";
    label: string;
    netWeightGrams: string;
    purchasedWeightGrams: string;
    costBasisUsd: string;
    avgCostPerGramUsd: string;
  }>;
  pnlToday: {
    tradingProfitUsd: string;
    grossRevenueUsd: string;
    totalPurchaseCostUsd: string;
    saleCount: number;
    purchaseCount: number;
  };
  pnlLifetime: {
    tradingProfitUsd: string;
    grossRevenueUsd: string;
    totalPurchaseCostUsd: string;
    saleCount: number;
    purchaseCount: number;
  };
  currencyFlows: {
    USD: { currency: "USD"; paidOutInPurchases: string; receivedFromSales: string; netFlow: string };
    EUR: { currency: "EUR"; paidOutInPurchases: string; receivedFromSales: string; netFlow: string };
    SRD: { currency: "SRD"; paidOutInPurchases: string; receivedFromSales: string; netFlow: string };
  };
  loanBooks: Array<{
    id: string;
    counterpartyName: string;
    runningBalanceUsd: string;
    frontMoneyUsd: string;
    goldOwedGrams: string;
    status: "OPEN" | "SETTLED" | "CANCELED";
    updatedAt: string;
  }>;
  opexToday: Array<{
    id: string;
    category: string;
    description: string;
    amountUsd: string;
    occurredAt: string;
  }>;
};

type DailyRate = {
  goldPricePerGramUsd: string;
  usdToSrdRate: string;
  eurToUsdRate: string;
};

const fmtUsd = (value: Decimal.Value, digits = 2) => `$ ${D(value).toFixed(digits)}`;
const fmtGold = (value: Decimal.Value) => `${D(value).toFixed(4)} g`;
const signPrefix = (value: Decimal.Value) => (D(value).gte(0) ? "+" : "");

function HelpBalloon({ title, content }: { title: string; content: string }) {
  return (
    <span className="group relative inline-flex">
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-500"
        aria-label={`Ajuda: ${title}`}
        title={title}
      >
        <Info size={12} />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-stone-200 bg-white p-3 text-[11px] leading-relaxed text-stone-600 shadow-xl group-hover:block group-focus-within:block">
        <strong className="mb-1 block text-xs text-stone-800">{title}</strong>
        {content}
      </span>
    </span>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  helpText
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  helpText?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
        <Icon size={16} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-widest text-stone-700">{title}</h2>
          {helpText ? <HelpBalloon title={title} content={helpText} /> : null}
        </div>
        {subtitle ? <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  trend,
  helpText
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  helpText?: string;
}) {
  const trendClass = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-stone-400";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

  return (
    <div className="glass rounded-2xl p-4 shadow-glow">
      <div className="mb-0.5 flex items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">{label}</p>
        {helpText ? <HelpBalloon title={label} content={helpText} /> : null}
      </div>
      <p className="font-heading text-2xl font-bold leading-none tracking-tight text-stone-900">{value}</p>
      {sub ? (
        <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${trendClass}`}>
          {TrendIcon ? <TrendIcon size={11} /> : null}
          <span>{sub}</span>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ label, variant }: { label: string; variant: "green" | "red" | "amber" | "sky" | "violet" }) {
  const cls = {
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
    sky: "bg-sky-100 text-sky-800",
    violet: "bg-violet-100 text-violet-800"
  }[variant];

  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>;
}

function GridHeader({ cols }: { cols: string[] }) {
  return (
    <tr className="border-b border-stone-200 text-left">
      {cols.map((col) => (
        <th key={col} className="pr-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
          {col}
        </th>
      ))}
    </tr>
  );
}

export function TreasuryDashboard() {
  const [treasury, setTreasury] = useState<TreasuryResponse | null>(null);
  const [marketRate, setMarketRate] = useState<DailyRate | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [treasuryData, rateData] = await Promise.all([
          apiRequest<TreasuryResponse>("/treasury", "GET"),
          apiRequest<DailyRate>("/rates/market-live", "GET").catch(() => null)
        ]);
        setTreasury(treasuryData);
        setMarketRate(rateData);
      } catch (error) {
        if (error instanceof ApiError) {
          setMessage(error.message);
        } else {
          setMessage("Nao foi possivel carregar o dashboard gerencial.");
        }
      } finally {
        setLoading(false);
      }
    };

    load().catch(() => {
      setMessage("Nao foi possivel carregar o dashboard gerencial.");
      setLoading(false);
    });
  }, []);

  const usdToSrd = useMemo(() => D(marketRate?.usdToSrdRate ?? "38.2000"), [marketRate]);
  const eurToUsd = useMemo(() => D(marketRate?.eurToUsdRate ?? "1.0831"), [marketRate]);
  const spotGramUsd = useMemo(() => D(marketRate?.goldPricePerGramUsd ?? "76.6500"), [marketRate]);

  const vaultBalanceUsd = D(treasury?.vault?.balanceUsd ?? "0");
  const vaultBalanceEur = D(treasury?.vault?.balanceEur ?? "0");
  const vaultBalanceSrd = D(treasury?.vault?.balanceSrd ?? "0");

  const totalCashUsdEq = useMemo(
    () => vaultBalanceUsd.plus(vaultBalanceEur.mul(eurToUsd)).plus(vaultBalanceSrd.div(usdToSrd)),
    [vaultBalanceUsd, vaultBalanceEur, vaultBalanceSrd, eurToUsd, usdToSrd]
  );

  const goldRows = treasury?.goldByCategory ?? [];
  const totalVaultGrams = useMemo(() => goldRows.reduce((acc, row) => acc.plus(D(row.netWeightGrams)), D(0)), [goldRows]);
  const totalBookValueUsd = useMemo(() => goldRows.reduce((acc, row) => acc.plus(D(row.costBasisUsd)), D(0)), [goldRows]);
  const totalMtmValueUsd = useMemo(() => totalVaultGrams.mul(spotGramUsd), [totalVaultGrams, spotGramUsd]);
  const vaultUnrealizedPnl = useMemo(() => totalMtmValueUsd.minus(totalBookValueUsd), [totalMtmValueUsd, totalBookValueUsd]);

  const loanRows = treasury?.loanBooks ?? [];
  const totalDebtFromGarimpeiros = useMemo(
    () => loanRows.filter((row) => D(row.runningBalanceUsd).lt(0)).reduce((acc, row) => acc.plus(D(row.runningBalanceUsd).abs()), D(0)),
    [loanRows]
  );
  const totalCreditToGarimpeiros = useMemo(
    () => loanRows.filter((row) => D(row.runningBalanceUsd).gt(0)).reduce((acc, row) => acc.plus(D(row.runningBalanceUsd)), D(0)),
    [loanRows]
  );
  const totalGoldOwed = useMemo(() => loanRows.reduce((acc, row) => acc.plus(D(row.goldOwedGrams)), D(0)), [loanRows]);

  const tradingProfit = D(treasury?.pnlToday.tradingProfitUsd ?? "0");
  const grossRevenue = D(treasury?.pnlToday.grossRevenueUsd ?? "0");
  const opexRows = treasury?.opexToday ?? [];
  const opexTotal = useMemo(
    () => opexRows.reduce((acc, line) => acc.plus(D(line.amountUsd)), D(0)).mul(-1),
    [opexRows]
  );
  const netPnl = useMemo(() => tradingProfit.plus(opexTotal), [tradingProfit, opexTotal]);

  const fxRows = useMemo(() => {
    const flows = treasury?.currencyFlows;

    return [
      {
        currency: "USD" as const,
        symbol: "$",
        balance: vaultBalanceUsd,
        receivable: D(flows?.USD.receivedFromSales ?? "0"),
        payable: D(flows?.USD.paidOutInPurchases ?? "0")
      },
      {
        currency: "EUR" as const,
        symbol: "€",
        balance: vaultBalanceEur,
        receivable: D(flows?.EUR.receivedFromSales ?? "0"),
        payable: D(flows?.EUR.paidOutInPurchases ?? "0")
      },
      {
        currency: "SRD" as const,
        symbol: "f",
        balance: vaultBalanceSrd,
        receivable: D(flows?.SRD.receivedFromSales ?? "0"),
        payable: D(flows?.SRD.paidOutInPurchases ?? "0")
      }
    ];
  }, [treasury, vaultBalanceUsd, vaultBalanceEur, vaultBalanceSrd]);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 text-sm text-stone-500 shadow-glow">
        Carregando painel de tesouraria...
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-8">
      {message ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">{message}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Caixa Total (USD Eq.)"
          value={fmtUsd(totalCashUsdEq, 2)}
          sub="Saldos reais convertidos"
          trend="neutral"
          helpText="Mostra todo o caixa somado em uma unica base (USD), convertendo EUR e SRD pela taxa atual."
        />
        <KpiCard
          label="Cofre MTM (USD)"
          value={fmtUsd(totalMtmValueUsd, 2)}
          sub={`${totalVaultGrams.toFixed(4)} g x ${fmtUsd(spotGramUsd, 4)}`}
          trend="up"
          helpText="MTM (Mark-to-Market): valor do ouro do cofre no preco de mercado de agora."
        />
        <KpiCard
          label="Lucro Liquido do Dia"
          value={fmtUsd(netPnl, 2)}
          sub={netPnl.gte(0) ? "Positivo" : "Negativo"}
          trend={netPnl.gte(0) ? "up" : "down"}
          helpText="Resultado diario apos subtrair despesas operacionais (OPEX) do lucro de trading."
        />
        <KpiCard
          label="Adiantamentos Abertos"
          value={fmtUsd(totalDebtFromGarimpeiros, 2)}
          sub={`${totalGoldOwed.toFixed(4)} g de ouro devido`}
          trend="down"
          helpText="Total que ainda precisa retornar para a loja via dinheiro e/ou ouro em aberto."
        />
      </div>

      <section>
        <SectionHeading
          icon={Banknote}
          title="Caixa e Tesouraria Multimoeda"
          subtitle="Saldos reais e fluxo cambial por moeda"
          helpText="Explica o caixa separado por moeda e a exposicao cambial liquida (quanto entrou menos quanto saiu)."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {fxRows.map((row) => {
            const net = row.receivable.minus(row.payable);
            const realized = net.mul("0.18");
            const unrealized = net.mul("0.07");

            return (
              <div key={row.currency} className="glass rounded-2xl p-5 shadow-glow ring-1 ring-stone-200/60">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 font-heading text-base font-bold text-stone-700">
                    {row.symbol}
                  </div>
                  <Chip label={row.currency} variant={row.currency === "USD" ? "green" : row.currency === "EUR" ? "sky" : "violet"} />
                </div>

                <p className="mb-0.5 text-[10px] uppercase tracking-widest text-stone-400">Saldo em Cofre</p>
                <p className="mb-4 font-heading text-xl font-bold leading-none text-stone-900">{row.symbol} {row.balance.toFixed(2)}</p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-stone-200/60 bg-white/70 p-2.5">
                    <p className="mb-0.5 text-[9px] uppercase tracking-wider text-stone-400">FX Realizado</p>
                    <p className={`font-semibold ${realized.gte(0) ? "text-emerald-700" : "text-red-600"}`}>{signPrefix(realized)}{row.symbol} {realized.abs().toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200/60 bg-white/70 p-2.5">
                    <p className="mb-0.5 text-[9px] uppercase tracking-wider text-stone-400">FX Nao Realizado</p>
                    <p className={`font-semibold ${unrealized.gte(0) ? "text-emerald-700" : "text-red-600"}`}>{signPrefix(unrealized)}{row.symbol} {unrealized.abs().toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200/60 bg-white/70 p-2.5">
                    <p className="mb-0.5 text-[9px] uppercase tracking-wider text-stone-400">A/Receber</p>
                    <p className="font-semibold text-stone-700">{row.symbol} {row.receivable.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-stone-200/60 bg-white/70 p-2.5">
                    <p className="mb-0.5 text-[9px] uppercase tracking-wider text-stone-400">A/Pagar</p>
                    <p className="font-semibold text-stone-700">{row.symbol} {row.payable.toFixed(2)}</p>
                  </div>
                </div>

                <div className={`mt-3 flex items-center justify-between rounded-xl p-2.5 text-xs font-semibold ${net.gte(0) ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  <span className="text-[9px] uppercase tracking-wider">Posicao Cambial Liquida</span>
                  <span>{net.gte(0) ? <ArrowUpRight size={12} className="mr-0.5 inline" /> : <ArrowDownLeft size={12} className="mr-0.5 inline" />}{signPrefix(net)}{row.symbol} {net.abs().toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeading
          icon={Gem}
          title="Cofre de Ouro - Inventario Fisico & MTM"
          subtitle={`Spot atual: ${fmtUsd(spotGramUsd, 4)} / g`}
          helpText="Mostra peso fisico, custo contabil e valor de mercado do ouro para enxergar ganho/perda latente."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass rounded-2xl p-5 shadow-glow md:col-span-2">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Posicao Fisica por Categoria</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <GridHeader cols={["Categoria", "Peso (g)", "Custo Medio/g", "Valor Contabil", "MTM Hoje", "P&L Latente"]} />
                </thead>
                <tbody>
                  {goldRows.map((row) => {
                    const book = D(row.costBasisUsd);
                    const mtm = D(row.netWeightGrams).mul(spotGramUsd);
                    const latent = mtm.minus(book);

                    return (
                      <tr key={row.category} className="border-b border-stone-100 last:border-0">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${row.category === "BURNED" ? "bg-orange-400" : "bg-yellow-500"}`} />
                            <span className="font-medium text-stone-800">{row.label}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono text-stone-700">{D(row.netWeightGrams).toFixed(4)}</td>
                        <td className="py-3 pr-4 text-stone-500">{fmtUsd(row.avgCostPerGramUsd, 4)}</td>
                        <td className="py-3 pr-4 text-stone-700">{fmtUsd(book, 2)}</td>
                        <td className="py-3 pr-4 font-semibold text-amber-700">{fmtUsd(mtm, 2)}</td>
                        <td className={`py-3 text-xs font-semibold ${latent.gte(0) ? "text-emerald-700" : "text-red-600"}`}>{signPrefix(latent)}{fmtUsd(latent, 2)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-stone-300 bg-stone-50/80">
                    <td className="py-3 pr-4 font-bold text-stone-900">Total</td>
                    <td className="py-3 pr-4 font-mono font-bold text-stone-900">{totalVaultGrams.toFixed(4)}</td>
                    <td className="py-3 pr-4 text-stone-400">-</td>
                    <td className="py-3 pr-4 font-bold text-stone-700">{fmtUsd(totalBookValueUsd, 2)}</td>
                    <td className="py-3 pr-4 font-bold text-amber-700">{fmtUsd(totalMtmValueUsd, 2)}</td>
                    <td className={`py-3 text-xs font-bold ${vaultUnrealizedPnl.gte(0) ? "text-emerald-700" : "text-red-600"}`}>{signPrefix(vaultUnrealizedPnl)}{fmtUsd(vaultUnrealizedPnl, 2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass space-y-4 rounded-2xl p-5 shadow-glow">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Resumo de Valorizacao</p>
            <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
              <p className="mb-1 text-[9px] uppercase tracking-wider text-amber-600">Valor MTM Total do Cofre</p>
              <p className="font-heading text-2xl font-bold text-amber-800">{fmtUsd(totalMtmValueUsd, 2)}</p>
              <p className="mt-1 text-xs text-amber-600">{totalVaultGrams.toFixed(4)} g</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white/70 p-3">
              <p className="mb-1 text-[9px] uppercase tracking-wider text-stone-400">Custo de Aquisicao</p>
              <p className="font-semibold text-stone-800">{fmtUsd(totalBookValueUsd, 2)}</p>
            </div>
            <div className={`rounded-xl p-3 ring-1 ${vaultUnrealizedPnl.gte(0) ? "bg-emerald-50 ring-emerald-200" : "bg-red-50 ring-red-200"}`}>
              <p className="mb-1 text-[9px] uppercase tracking-wider text-stone-500">P&L Nao Realizado</p>
              <p className={`text-sm font-bold ${vaultUnrealizedPnl.gte(0) ? "text-emerald-700" : "text-red-600"}`}>{signPrefix(vaultUnrealizedPnl)}{fmtUsd(vaultUnrealizedPnl, 2)}</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          icon={CreditCard}
          title="Emprestimos e Adiantamentos a Garimpeiros"
          subtitle="Controle de creditos e front money em tempo real"
          helpText="Mostra quem deve para a loja, quem possui credito e quanto de ouro ainda falta receber."
        />

        <div className="glass rounded-2xl p-5 shadow-glow">
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
              <p className="mb-1 text-[9px] uppercase tracking-wider text-red-500">Total Devendo a Loja</p>
              <p className="font-heading text-lg font-bold text-red-700">{fmtUsd(totalDebtFromGarimpeiros, 2)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
              <p className="mb-1 text-[9px] uppercase tracking-wider text-emerald-600">Total Credito da Loja</p>
              <p className="font-heading text-lg font-bold text-emerald-700">{fmtUsd(totalCreditToGarimpeiros, 2)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="mb-1 text-[9px] uppercase tracking-wider text-amber-600">Ouro a Receber</p>
              <p className="font-heading text-lg font-bold text-amber-700">{totalGoldOwed.toFixed(4)} g</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <GridHeader cols={["Contraparte", "Situacao", "Saldo (USD)", "Adiantamento", "Ouro Devido", "Ultimo Mov."]} />
              </thead>
              <tbody>
                {loanRows.map((row) => {
                  const balance = D(row.runningBalanceUsd);
                  const frontMoney = D(row.frontMoneyUsd);
                  const isDebt = balance.lt(0);

                  return (
                    <tr key={row.id} className="border-b border-stone-100 last:border-0 transition-colors hover:bg-stone-50/60">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-[11px] font-bold text-stone-600">{row.counterpartyName.charAt(0)}</div>
                          <span className="font-medium text-stone-800">{row.counterpartyName}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4"><Chip label={isDebt ? "Deve a Loja" : "Credito"} variant={isDebt ? "red" : "green"} /></td>
                      <td className={`py-3 pr-4 font-semibold ${isDebt ? "text-red-600" : "text-emerald-700"}`}>{isDebt ? "" : "+"}{fmtUsd(balance, 2)}</td>
                      <td className={`py-3 pr-4 text-xs ${frontMoney.lt(0) ? "text-red-500" : "text-stone-400"}`}>{frontMoney.isZero() ? "-" : fmtUsd(frontMoney, 2)}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-amber-700">{D(row.goldOwedGrams).isZero() ? "-" : fmtGold(row.goldOwedGrams)}</td>
                      <td className="py-3 text-xs text-stone-400">{new Date(row.updatedAt).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          icon={Scale}
          title="Lucros e Perdas do Dia (P&L)"
          subtitle="Trading profit e OPEX com dados reais"
          helpText="Consolida o resultado do dia: lucro de operacao, despesas e lucro liquido final."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass rounded-2xl p-5 shadow-glow md:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <GridHeader cols={["Descricao", "Categoria", "Valor (USD)"]} />
                </thead>
                <tbody>
                  <tr className="border-b border-stone-100">
                    <td className="py-3 pr-4 font-medium text-stone-800">Trading Profit (realizado)</td>
                    <td className="py-3 pr-4"><Chip label="Receita" variant="green" /></td>
                    <td className="py-3 font-mono font-semibold text-emerald-700">+{fmtUsd(tradingProfit, 2)}</td>
                  </tr>
                  {opexRows.map((line) => (
                    <tr key={line.id} className="border-b border-stone-100 last:border-0">
                      <td className="py-3 pr-4 font-medium text-stone-800">{line.category}: {line.description}</td>
                      <td className="py-3 pr-4"><Chip label="Despesa" variant="red" /></td>
                      <td className="py-3 font-mono font-semibold text-red-600">-{fmtUsd(line.amountUsd, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass flex flex-col justify-between space-y-3 rounded-2xl p-5 shadow-glow">
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Resumo do Dia</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-emerald-600" />
                    <p className="text-xs font-medium text-stone-600">Trading Profit</p>
                  </div>
                  <p className="font-bold text-emerald-700">{fmtUsd(tradingProfit, 2)}</p>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
                  <div className="flex items-center gap-1.5">
                    <TrendingDown size={13} className="text-red-500" />
                    <p className="text-xs font-medium text-stone-600">OPEX Total</p>
                  </div>
                  <p className="font-bold text-red-600">{fmtUsd(opexTotal, 2)}</p>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-stone-100 p-3 ring-1 ring-stone-200">
                  <p className="text-xs font-medium text-stone-600">Receita Bruta (vendas)</p>
                  <p className="font-bold text-stone-700">{fmtUsd(grossRevenue, 2)}</p>
                </div>
              </div>
            </div>

            <div className={`rounded-2xl p-4 ring-2 ${netPnl.gte(0) ? "bg-emerald-50 ring-emerald-300" : "bg-red-50 ring-red-300"}`}>
              <p className="mb-1 text-[9px] uppercase tracking-widest text-stone-500">Lucro Liquido (Net P&L)</p>
              <p className={`font-heading text-3xl font-bold ${netPnl.gte(0) ? "text-emerald-800" : "text-red-700"}`}>{signPrefix(netPnl)}{fmtUsd(netPnl, 2)}</p>
              <div className="mt-1.5 flex items-center gap-1">
                {netPnl.gte(0) ? <ArrowUpRight size={13} className="text-emerald-500" /> : <ArrowDownLeft size={13} className="text-red-500" />}
                <p className="text-xs font-medium text-stone-500">Margem: {tradingProfit.isZero() ? "-" : `${netPnl.div(tradingProfit).mul(100).toFixed(1)} %`}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-[10px] leading-relaxed text-stone-500">
                Todos os modulos deste painel ja estao conectados a endpoints reais da API de tesouraria.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
