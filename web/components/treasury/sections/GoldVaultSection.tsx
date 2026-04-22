import { Gem } from "lucide-react";
import { D } from "@/lib/decimal";
import type { useTreasuryDashboardState } from "../useTreasuryDashboardState";
import { GridHeader, SectionHeading } from "../ui";
import { fmtUsd, signPrefix } from "../formatters";

type DashboardState = ReturnType<typeof useTreasuryDashboardState>;

type GoldVaultSectionProps = Pick<
  DashboardState,
  "spotGramUsd" | "goldRows" | "totalVaultGrams" | "totalBookValueUsd" | "totalMtmValueUsd" | "vaultUnrealizedPnl"
>;

export function GoldVaultSection({
  spotGramUsd,
  goldRows,
  totalVaultGrams,
  totalBookValueUsd,
  totalMtmValueUsd,
  vaultUnrealizedPnl
}: GoldVaultSectionProps) {
  return (
    <section>
      <SectionHeading
        icon={Gem}
        title="Ouro no Cofre"
        subtitle={`Cotacao usada hoje: ${fmtUsd(spotGramUsd, 4)} por grama`}
        helpText="Mostra quanto ouro existe no cofre, quanto foi gasto para comprar e quanto ele valeria hoje."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-2xl p-5 shadow-glow md:col-span-2">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">Ouro separado por tipo</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <GridHeader cols={["Categoria", "Peso (g)", "Preco Medio Pago por Grama", "Custo Total Gasto no Ouro", "Valor Total se Vender Hoje", "Lucro Esperado (Se vender hoje)"]} />
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
                      <td className="py-3 pr-4 text-stone-700">{fmtUsd(book, 4)}</td>
                      <td className="py-3 pr-4 font-semibold text-amber-700">{fmtUsd(mtm, 4)}</td>
                      <td className={`py-3 text-xs font-semibold ${latent.gte(0) ? "text-emerald-700" : "text-red-600"}`}>{signPrefix(latent)}{fmtUsd(latent, 4)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-stone-300 bg-stone-50/80">
                  <td className="py-3 pr-4 font-bold text-stone-900">Total</td>
                  <td className="py-3 pr-4 font-mono font-bold text-stone-900">{totalVaultGrams.toFixed(4)}</td>
                  <td className="py-3 pr-4 text-stone-400">-</td>
                  <td className="py-3 pr-4 font-bold text-stone-700">{fmtUsd(totalBookValueUsd, 4)}</td>
                  <td className="py-3 pr-4 font-bold text-amber-700">{fmtUsd(totalMtmValueUsd, 4)}</td>
                  <td className={`py-3 text-xs font-bold ${vaultUnrealizedPnl.gte(0) ? "text-emerald-700" : "text-red-600"}`}>{signPrefix(vaultUnrealizedPnl)}{fmtUsd(vaultUnrealizedPnl, 4)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass space-y-4 rounded-2xl p-5 shadow-glow">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Resumo do valor do ouro</p>
          <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <p className="mb-1 text-[9px] uppercase tracking-wider text-amber-600">Valor do Ouro no Cofre Hoje</p>
            <p className="font-heading text-2xl font-bold text-amber-800">{fmtUsd(totalMtmValueUsd, 4)}</p>
            <p className="mt-1 text-xs text-amber-600">{totalVaultGrams.toFixed(4)} g</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white/70 p-3">
            <p className="mb-1 text-[9px] uppercase tracking-wider text-stone-400">Quanto foi gasto para comprar</p>
            <p className="font-semibold text-stone-800">{fmtUsd(totalBookValueUsd, 4)}</p>
          </div>
          <div className={`rounded-xl p-3 ring-1 ${vaultUnrealizedPnl.gte(0) ? "bg-emerald-50 ring-emerald-200" : "bg-red-50 ring-red-200"}`}>
            <p className="mb-1 text-[9px] uppercase tracking-wider text-stone-500">Lucro Esperado (Se vender hoje)</p>
            <p className={`text-sm font-bold ${vaultUnrealizedPnl.gte(0) ? "text-emerald-700" : "text-red-600"}`}>{signPrefix(vaultUnrealizedPnl)}{fmtUsd(vaultUnrealizedPnl, 4)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
