import { AmountAlert, PaymentCurrency, PaymentLine, PaymentPreview, RateSnapshot, decimalText, getSuggestedRate } from "@/lib/treasury";

type TreasurySplitPlannerProps = {
  paymentLines: PaymentLine[];
  paymentPreview: PaymentPreview[];
  amountAlert: AmountAlert;
  rate: RateSnapshot | null;
  settlementLabel: string;
  helperText: string;
  onAdd: () => void;
  onRemove: (lineId: string) => void;
  onSetLine: (lineId: string, field: keyof PaymentLine, value: string) => void;
};

export function TreasurySplitPlanner({
  paymentLines,
  paymentPreview,
  amountAlert,
  rate,
  settlementLabel,
  helperText,
  onAdd,
  onRemove,
  onSetLine
}: TreasurySplitPlannerProps) {
  const setCurrency = (lineId: string, currency: PaymentCurrency) => {
    onSetLine(lineId, "currency", currency);
    onSetLine(lineId, "manualExchangeRate", getSuggestedRate(currency, rate));
  };

  return (
    <>
      <div className="rounded-2xl border border-stone-300/70 bg-white/80 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-base font-semibold text-stone-800">Pagamento Fracionado | Caixa Multimoeda</h3>
            <p className="text-sm text-stone-600">{helperText}</p>
          </div>
          <button type="button" onClick={onAdd} className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-stone-700">
            Adicionar linha
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="px-2 py-2">Moeda</th>
                <th className="px-2 py-2">Split %</th>
                <th className="px-2 py-2">Valor Split (USD)</th>
                <th className="px-2 py-2">Taxa de Câmbio Manual</th>
                <th className="px-2 py-2">{settlementLabel}</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {paymentLines.map((line) => {
                const preview = paymentPreview.find((item) => item.id === line.id);
                return (
                  <tr key={line.id} className="border-b border-stone-200/70 align-top last:border-b-0">
                    <td className="px-2 py-2">
                      <select value={line.currency} onChange={(event) => setCurrency(line.id, event.target.value as PaymentCurrency)}>
                        <option value="USD">USD</option>
                        <option value="SRD">SRD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input value={line.splitPercentage} onChange={(event) => onSetLine(line.id, "splitPercentage", event.target.value)} placeholder="Ex: 30.0000" />
                    </td>
                    <td className="px-2 py-2">
                      <input value={line.splitAmountUsd} onChange={(event) => onSetLine(line.id, "splitAmountUsd", event.target.value)} placeholder="Ex: 1500.0000" />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={line.currency === "USD" ? "" : line.manualExchangeRate}
                        onChange={(event) => onSetLine(line.id, "manualExchangeRate", event.target.value)}
                        placeholder={line.currency === "USD" ? "Não aplicável" : "0.0000"}
                        disabled={line.currency === "USD"}
                        className={line.currency === "USD" ? "bg-stone-100" : ""}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-semibold text-stone-900">{line.currency} {preview ? decimalText(preview.settlementAmount) : "0.0000"}</div>
                      <p className="mt-1 text-xs text-stone-500">USD {preview ? decimalText(preview.splitAmountUsd) : "0.0000"} | {preview ? decimalText(preview.splitPercentage) : "0.0000"}%</p>
                      {preview?.error ? <p className="mt-1 text-xs font-medium text-red-700">{preview.error}</p> : null}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button type="button" onClick={() => onRemove(line.id)} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100">
                        Remover
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${amountAlert.tone === "emerald" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}`}>
        {amountAlert.text}
      </div>
    </>
  );
}