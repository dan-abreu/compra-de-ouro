"use client";

import { useMemo } from "react";

import { D, format4, q4 } from "@/lib/decimal";

export type Currency = "SRD" | "USD" | "EUR";

export type Split = {
  currency: Currency;
  amount: string;
};

export function SplitPaymentEditor({
  splits,
  onChange,
  usdToSrdRate,
  eurToSrdRate,
  targetSrd
}: {
  splits: Split[];
  onChange: (next: Split[]) => void;
  usdToSrdRate: string;
  eurToSrdRate: string;
  targetSrd: string;
}) {
  const convertedTotal = useMemo(() => {
    const usdRate = q4(usdToSrdRate || "0");
    const eurRate = q4(eurToSrdRate || "0");

    return splits.reduce((acc, split) => {
      const amount = q4(split.amount || "0");
      if (split.currency === "SRD") return q4(acc.add(amount));
      if (split.currency === "USD") return q4(acc.add(amount.mul(usdRate)));
      return q4(acc.add(amount.mul(eurRate)));
    }, D(0));
  }, [splits, usdToSrdRate, eurToSrdRate]);

  const exactMatch = q4(targetSrd || "0").equals(convertedTotal);

  return (
    <div className="space-y-3">
      {splits.map((split, index) => (
        <div key={`${split.currency}-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[120px_1fr_auto]">
          <select
            value={split.currency}
            onChange={(event) => {
              const next = [...splits];
              next[index] = { ...next[index], currency: event.target.value as Currency };
              onChange(next);
            }}
          >
            <option value="SRD">SRD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>

          <input
            type="text"
            inputMode="decimal"
            value={split.amount}
            placeholder="0.0000"
            onChange={(event) => {
              const next = [...splits];
              next[index] = { ...next[index], amount: event.target.value };
              onChange(next);
            }}
          />

          <button
            type="button"
            className="rounded-xl bg-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-300"
            onClick={() => onChange(splits.filter((_, i) => i !== index))}
            disabled={splits.length === 1}
          >
            remover
          </button>
        </div>
      ))}

      <button
        type="button"
        className="rounded-xl bg-brand-clay px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
        onClick={() => onChange([...splits, { currency: "SRD", amount: "" }])}
      >
        adicionar split
      </button>

      <div className="rounded-xl border border-stone-300 bg-white/90 p-3 text-sm">
        <p>Total convertido SRD: <strong>{format4(convertedTotal)}</strong></p>
        <p>Alvo SRD: <strong>{format4(targetSrd || "0")}</strong></p>
        <p className={exactMatch ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
          {exactMatch ? "Split confere exatamente" : "Split divergente"}
        </p>
      </div>
    </div>
  );
}
