import Decimal from "decimal.js";

import { OUNCE_IN_GRAMS, SUGGESTION_FACTOR, ZERO, decimalText, parseDecimal } from "@/lib/treasury";

const HUNDRED = new Decimal("100");

const usdFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatUsd = (value: Decimal) => usdFormatter.format(Number(value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()));

export function PriceSuggestionBreakdown({
  spotPriceOz,
  purityPercentage
}: {
  spotPriceOz: string;
  purityPercentage: string;
}) {
  const spotPrice = parseDecimal(spotPriceOz);
  const purity = parseDecimal(purityPercentage, "100");
  const clampedPurity = Decimal.min(Decimal.max(purity, ZERO), HUNDRED);

  const pureGramValue = spotPrice.div(OUNCE_IN_GRAMS).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const spreadFactor = new Decimal(1).sub(SUGGESTION_FACTOR);
  const spreadValue = pureGramValue.mul(spreadFactor.abs()).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const suggestedPureGram = pureGramValue.mul(SUGGESTION_FACTOR).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const suggestedPhysicalGram = suggestedPureGram.mul(clampedPurity.div(HUNDRED)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const purityAffectsPrice = purityPercentage.trim() !== "" && !clampedPurity.eq(HUNDRED);
  const isDiscount = spreadFactor.gte(ZERO);

  return (
    <div className="rounded-2xl border border-amber-300/70 bg-amber-50/90 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-stone-800">Breakdown do Preço</h3>
          <p className="text-sm text-stone-600">Guia visual para explicar a formação do preço sugerido no balcão.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700 shadow-sm">Spread da Loja: 10%</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-white/80 bg-white/80 px-3 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Cotação da Bolsa (USD/oz)</p>
            <p className="text-xs text-stone-500">Preço internacional bruto recebido da cotação do dia.</p>
          </div>
          <p className="text-base font-semibold text-stone-900">{formatUsd(spotPrice)}</p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/80 bg-white/80 px-3 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Valor da Grama Pura (USD/g)</p>
            <p className="text-xs text-stone-500">Cotação da bolsa dividida por 31.1035 g da onça troy.</p>
          </div>
          <div className="text-right">
            <p className="text-base font-semibold text-stone-900">{formatUsd(pureGramValue)}</p>
            <p className="text-xs text-stone-500">{decimalText(pureGramValue)} USD/g</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-red-600">Desconto/Prêmio Aplicado</p>
            <p className="text-xs text-red-600">{isDiscount ? "Margem comercial abatida sobre a grama pura." : "Margem comercial adicionada sobre a grama pura."}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-semibold text-red-700">{isDiscount ? "-" : "+"} {formatUsd(spreadValue)}</p>
            <p className="text-xs text-red-600">{isDiscount ? "-" : "+"} {decimalText(spreadValue)} USD/g</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-700">Preço Sugerido (USD/g)</p>
            <p className="text-xs text-emerald-700">
              {purityAffectsPrice
                ? `Preço sugerido ajustado pela pureza informada (${decimalText(clampedPurity)}%).`
                : "Preço sugerido final por grama para orientar a negociação."}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-emerald-800">{formatUsd(purityAffectsPrice ? suggestedPhysicalGram : suggestedPureGram)}</p>
            <p className="text-xs font-semibold text-emerald-700">
              {decimalText(purityAffectsPrice ? suggestedPhysicalGram : suggestedPureGram)} USD/g
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}