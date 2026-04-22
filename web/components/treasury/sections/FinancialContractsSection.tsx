import { CreditCard } from "lucide-react";

import { D } from "@/lib/decimal";
import type { useTreasuryDashboardState } from "../useTreasuryDashboardState";
import { actionButtonClassName, Chip, GridHeader, SectionHeading } from "../ui";
import { fmtCurrency, fmtGold, fmtUsd } from "../formatters";

type DashboardState = ReturnType<typeof useTreasuryDashboardState>;

type FinancialContractsSectionProps = Pick<
  DashboardState,
  "loanRows" | "totalStorePayables" | "totalStoreReceivables" | "totalMonthlyFinancialCost" | "totalMonthlyFinancialRevenue"
> & {
  onOpenLoanModal: () => void;
};

export function FinancialContractsSection({
  loanRows,
  totalStorePayables,
  totalStoreReceivables,
  totalMonthlyFinancialCost,
  totalMonthlyFinancialRevenue,
  onOpenLoanModal
}: FinancialContractsSectionProps) {
  return (
    <section>
      <SectionHeading
        icon={CreditCard}
        title="Contratos Financeiros"
        subtitle="Gestao de obrigacoes e direitos da loja com custo mensal"
        helpText="Organiza contratos em duas direcoes: recursos recebidos pela loja (a pagar) e recursos concedidos pela loja (a receber)."
        action={
          <button type="button" className={actionButtonClassName} onClick={onOpenLoanModal}>
            + Novo Contrato
          </button>
        }
      />

      <div className="glass rounded-2xl p-5 shadow-glow">
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
            <p className="mb-1 text-[9px] uppercase tracking-wider text-red-500">Obrigacoes da Loja (A Pagar)</p>
            <p className="font-heading text-lg font-bold text-red-700">{fmtUsd(totalStorePayables, 4)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
            <p className="mb-1 text-[9px] uppercase tracking-wider text-emerald-600">Direitos da Loja (A Receber)</p>
            <p className="font-heading text-lg font-bold text-emerald-700">{fmtUsd(totalStoreReceivables, 4)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <p className="mb-1 text-[9px] uppercase tracking-wider text-amber-600">Encargo Mensal Liquido</p>
            <p className="font-heading text-lg font-bold text-amber-700">{fmtUsd(totalMonthlyFinancialCost.minus(totalMonthlyFinancialRevenue), 4)}</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-red-700">Custo financeiro mensal</p>
            <p className="mt-1 text-sm font-bold text-red-700">{fmtUsd(totalMonthlyFinancialCost, 4)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Receita financeira mensal</p>
            <p className="mt-1 text-sm font-bold text-emerald-700">{fmtUsd(totalMonthlyFinancialRevenue, 4)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <GridHeader
                cols={[
                  "Direcao",
                  "Contraparte",
                  "Tipo",
                  "Caixa Impactado",
                  "Principal (USD)",
                  "Saldo Atual (USD)",
                  "Custo Mensal",
                  "Liquidacao",
                  "Vencimento",
                  "Ultima Atualizacao"
                ]}
              />
            </thead>
            <tbody>
              {loanRows.map((row) => {
                const balance = D(row.runningBalanceUsd).abs();
                const principal = D(row.principalAmountUsd).abs();
                const isStorePayable = row.direction === "RECEIVED";
                const monthlyCostLabel =
                  row.monthlyCostType === "PERCENTAGE"
                    ? `${D(row.monthlyRatePercent).toFixed(4)}%`
                    : row.monthlyCostType === "FIXED"
                      ? fmtUsd(row.monthlyFixedCostUsd, 2)
                      : "Sem encargo";
                const counterpartyTypeLabel =
                  row.counterpartyType === "CLIENT"
                    ? "Cliente"
                    : row.counterpartyType === "SUPPLIER"
                      ? "Fornecedor"
                      : row.counterpartyType === "EMPLOYEE"
                        ? "Funcionario"
                        : "Terceiro";
                const directionLabel = isStorePayable
                  ? "Entrou no caixa da loja"
                  : "Saiu do caixa da loja";
                const settlementLabel =
                  row.settlementExpectation === "CASH"
                    ? "Dinheiro"
                    : row.settlementExpectation === "GOLD"
                      ? "Ouro"
                      : "Misto";
                const cashMovementLabel = row.cashEffectDirection === "IN" ? "Entrada" : "Saida";
                const cashBoxLabel =
                  row.inputCurrency === "GOLD"
                    ? `${cashMovementLabel} no cofre de ouro`
                    : `${cashMovementLabel} no caixa ${row.inputCurrency}`;

                return (
                  <tr key={row.id} className="border-b border-stone-100 last:border-0 transition-colors hover:bg-stone-50/60">
                    <td className="py-3 pr-4">
                      <Chip label={directionLabel} variant={isStorePayable ? "red" : "green"} />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-[11px] font-bold text-stone-600">{row.counterpartyName.charAt(0)}</div>
                        <span className="font-medium text-stone-800">{row.counterpartyName}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-stone-600">{counterpartyTypeLabel}</td>
                    <td className="py-3 pr-4 text-xs text-stone-600">
                      <p>{cashBoxLabel}</p>
                      <p className="font-semibold text-stone-700">
                        {row.inputCurrency === "GOLD"
                          ? fmtGold(row.inputAmount)
                          : fmtCurrency(row.inputCurrency === "EUR" ? "€" : row.inputCurrency === "SRD" ? "f" : "$", row.inputAmount)}
                      </p>
                    </td>
                    <td className="py-3 pr-4 font-semibold text-stone-700">{fmtUsd(principal, 4)}</td>
                    <td className={`py-3 pr-4 font-semibold ${isStorePayable ? "text-red-600" : "text-emerald-700"}`}>{fmtUsd(balance, 4)}</td>
                    <td className="py-3 pr-4 text-xs text-stone-600">
                      <p>{monthlyCostLabel}</p>
                      <p className="font-semibold text-stone-700">{fmtUsd(row.monthlyCostUsd, 4)}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs text-stone-600">
                      <p>{settlementLabel}</p>
                      <p className="font-mono text-amber-700">{D(row.goldOwedGrams).isZero() ? "-" : fmtGold(row.goldOwedGrams)}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs text-stone-600">{row.dueDate ? new Date(row.dueDate).toLocaleDateString("pt-BR") : "Sem vencimento"}</td>
                    <td className="py-3 text-xs text-stone-400">{new Date(row.updatedAt).toLocaleDateString("pt-BR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
