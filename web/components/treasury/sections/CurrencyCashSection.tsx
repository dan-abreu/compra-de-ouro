import { ArrowDownLeft, ArrowUpRight, Banknote } from "lucide-react";
import type { useTreasuryDashboardState } from "../useTreasuryDashboardState";
import { Chip, SectionHeading } from "../ui";
import { fmtCurrency, signPrefix } from "../formatters";

type DashboardState = ReturnType<typeof useTreasuryDashboardState>;

type CurrencyCashSectionProps = Pick<DashboardState, "fxRows">;

export function CurrencyCashSection({ fxRows }: CurrencyCashSectionProps) {
  return (
    <section>
      <SectionHeading
        icon={Banknote}
        title="Caixa por Moeda"
        subtitle="Veja o saldo base, o que entrou, o que saiu e o saldo ajustado em cada caixa"
        helpText="Ajuda a enxergar caixa por moeda com impacto separado de vendas, compras, emprestimos e despesas."
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

              <p className="mb-0.5 text-[10px] uppercase tracking-widest text-stone-400">Saldo ajustado no caixa</p>
              <p className="mb-4 font-heading text-xl font-bold leading-none text-stone-900">{fmtCurrency(row.symbol, row.balance)}</p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-stone-200/60 bg-white/70 p-2.5">
                  <p className="mb-0.5 text-[9px] uppercase tracking-wider text-stone-400">Saldo base do caixa</p>
                  <p className="font-semibold text-stone-700">{fmtCurrency(row.symbol, row.baseBalance)}</p>
                </div>
                <div className="rounded-xl border border-stone-200/60 bg-white/70 p-2.5">
                  <p className="mb-0.5 text-[9px] uppercase tracking-wider text-stone-400">Entrou por emprestimos</p>
                  <p className="font-semibold text-emerald-700">{fmtCurrency(row.symbol, row.loanInflow)}</p>
                </div>
                <div className="rounded-xl border border-stone-200/60 bg-white/70 p-2.5">
                  <p className="mb-0.5 text-[9px] uppercase tracking-wider text-stone-400">Saiu por emprestimos</p>
                  <p className="font-semibold text-red-600">{fmtCurrency(row.symbol, row.loanOutflow)}</p>
                </div>
                <div className="rounded-xl border border-stone-200/60 bg-white/70 p-2.5">
                  <p className="mb-0.5 text-[9px] uppercase tracking-wider text-stone-400">Saiu por despesas</p>
                  <p className="font-semibold text-red-600">{fmtCurrency(row.symbol, row.expenseOutflow)}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-stone-200/60 bg-white/70 p-2.5">
                  <p className="mb-0.5 text-[9px] uppercase tracking-wider text-stone-400">Entradas de vendas</p>
                  <p className="font-semibold text-stone-700">{fmtCurrency(row.symbol, row.receivable)}</p>
                </div>
                <div className="rounded-xl border border-stone-200/60 bg-white/70 p-2.5">
                  <p className="mb-0.5 text-[9px] uppercase tracking-wider text-stone-400">Saidas de compras</p>
                  <p className="font-semibold text-stone-700">{fmtCurrency(row.symbol, row.payable)}</p>
                </div>
              </div>

              <div className={`mt-3 flex items-center justify-between rounded-xl p-2.5 text-xs font-semibold ${net.gte(0) ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                <span className="text-[9px] uppercase tracking-wider">Fluxo comercial liquido na moeda</span>
                <span>{net.gte(0) ? <ArrowUpRight size={12} className="mr-0.5 inline" /> : <ArrowDownLeft size={12} className="mr-0.5 inline" />}{signPrefix(net)}{fmtCurrency(row.symbol, net.abs())}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
