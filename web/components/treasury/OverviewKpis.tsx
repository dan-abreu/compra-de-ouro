import type { useTreasuryDashboardState } from "./useTreasuryDashboardState";
import { KpiCard } from "./ui";
import { fmtGold, fmtUsd } from "./formatters";

type DashboardState = ReturnType<typeof useTreasuryDashboardState>;

type OverviewKpisProps = Pick<
  DashboardState,
  "totalCashUsdEq" | "totalMtmValueUsd" | "netPnl" | "totalStoreReceivables" | "totalGoldOwed" | "totalVaultGrams" | "spotGramUsd"
>;

export function OverviewKpis({
  totalCashUsdEq,
  totalMtmValueUsd,
  netPnl,
  totalStoreReceivables,
  totalGoldOwed,
  totalVaultGrams,
  spotGramUsd
}: OverviewKpisProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiCard
        label="Dinheiro Total na Loja (em Dolares)"
        value={fmtUsd(totalCashUsdEq, 4)}
        sub="Somando USD, EUR e SRD"
        trend="neutral"
        helpText="Mostra quanto dinheiro a loja tem ao todo, convertendo tudo para dolar para facilitar a leitura."
      />
      <KpiCard
        label="Valor do Ouro no Cofre (Cotacao de Hoje)"
        value={fmtUsd(totalMtmValueUsd, 4)}
        sub={`${fmtGold(totalVaultGrams)} x ${fmtUsd(spotGramUsd, 4)}`}
        trend="up"
        helpText="Mostra quanto vale o ouro parado no cofre se fosse avaliado pelo preco de hoje."
      />
      <KpiCard
        label="Lucro Limpo do Dia (O que sobrou)"
        value={fmtUsd(netPnl, 4)}
        sub={netPnl.gte(0) ? "Positivo" : "Negativo"}
        trend={netPnl.gte(0) ? "up" : "down"}
        helpText="Mostra o que realmente sobrou no dia depois de descontar as despesas da loja."
      />
      <KpiCard
        label="Dinheiro Emprestado (A Receber)"
        value={fmtUsd(totalStoreReceivables, 4)}
        sub={`${fmtGold(totalGoldOwed)} de ouro devido`}
        trend="down"
        helpText="Mostra quanto dinheiro a loja emprestou e ainda precisa receber de volta."
      />
    </div>
  );
}
