import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Scale, TrendingDown, TrendingUp } from "lucide-react";

import type { useTreasuryDashboardState } from "../useTreasuryDashboardState";
import { actionButtonClassName, Chip, GridHeader, SectionHeading } from "../ui";
import { fmtUsd, signPrefix } from "../formatters";

type DashboardState = ReturnType<typeof useTreasuryDashboardState>;

type DailyPnlSectionProps = Pick<DashboardState, "tradingProfit" | "opexRows" | "opexTotal" | "grossRevenue" | "netPnl"> & {
  onOpenExpenseModal: () => void;
};

export function DailyPnlSection({
  tradingProfit,
  opexRows,
  opexTotal,
  grossRevenue,
  netPnl,
  onOpenExpenseModal
}: DailyPnlSectionProps) {
  return (
    <section>
      <SectionHeading
        icon={Scale}
        title="Lucros e Perdas do Dia"
        subtitle="Mostra o lucro das operacoes e as despesas do dia"
        helpText="Consolida o resultado do dia: quanto a loja ganhou comprando e vendendo ouro e quanto saiu em despesas."
        action={
          <button type="button" className={actionButtonClassName} onClick={onOpenExpenseModal}>
            + Lancar Nova Despesa
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-2xl p-5 shadow-glow md:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <GridHeader cols={["Descricao", "Categoria", "Valor convertido para dolar"]} />
              </thead>
              <tbody>
                <tr className="border-b border-stone-100">
                  <td className="py-3 pr-4 font-medium text-stone-800">Lucro da Compra e Venda de Ouro</td>
                  <td className="py-3 pr-4"><Chip label="Receita" variant="green" /></td>
                  <td className="py-3 font-mono font-semibold text-emerald-700">+{fmtUsd(tradingProfit, 4)}</td>
                </tr>
                {opexRows.map((line) => (
                  <tr key={line.id} className="border-b border-stone-100 last:border-0">
                    <td className="py-3 pr-4 font-medium text-stone-800">{line.description}</td>
                    <td className="py-3 pr-4"><Chip label="Despesa" variant="red" /></td>
                    <td className="py-3 font-mono font-semibold text-red-600">-{fmtUsd(line.amountUsd, 4)}</td>
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
                  <p className="text-xs font-medium text-stone-600">Lucro da Compra e Venda de Ouro</p>
                </div>
                <p className="font-bold text-emerald-700">{fmtUsd(tradingProfit, 4)}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={13} className="text-red-500" />
                  <p className="text-xs font-medium text-stone-600">Despesas da Loja (Salarios, Contas, etc.)</p>
                </div>
                <p className="font-bold text-red-600">{fmtUsd(opexTotal, 4)}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-stone-100 p-3 ring-1 ring-stone-200">
                <p className="text-xs font-medium text-stone-600">Receita Bruta (vendas)</p>
                <p className="font-bold text-stone-700">{fmtUsd(grossRevenue, 4)}</p>
              </div>
            </div>
          </div>

          <div className={`rounded-2xl p-4 ring-2 ${netPnl.gte(0) ? "bg-emerald-50 ring-emerald-300" : "bg-red-50 ring-red-300"}`}>
            <p className="mb-1 text-[9px] uppercase tracking-widest text-stone-500">Lucro/Prejuizo Final do Dia</p>
            <p className={`font-heading text-3xl font-bold ${netPnl.gte(0) ? "text-emerald-800" : "text-red-700"}`}>{signPrefix(netPnl)}{fmtUsd(netPnl, 4)}</p>
            <div className="mt-1.5 flex items-center gap-1">
              {netPnl.gte(0) ? <ArrowUpRight size={13} className="text-emerald-500" /> : <ArrowDownLeft size={13} className="text-red-500" />}
              <p className="text-xs font-medium text-stone-500">Margem: {tradingProfit.isZero() ? "-" : `${netPnl.div(tradingProfit).mul(100).toFixed(1)} %`}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-[10px] leading-relaxed text-stone-500">
              Os novos botoes de cadastro funcionam no estado local da tela e deixam a estrutura pronta para integrar com a API depois.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
