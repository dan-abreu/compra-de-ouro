"use client";

import { useEffect, useMemo, useState } from "react";

import { Split, SplitPaymentEditor } from "@/components/split-payment";
import { Card } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { D, format4, q4 } from "@/lib/decimal";

type DailyRate = {
  id: string;
  usdToSrdRate: string;
  eurToSrdRate: string;
};

const initialSplits: Split[] = [{ currency: "SRD", amount: "" }];

export default function VendaPage() {
  const [rate, setRate] = useState<DailyRate | null>(null);
  const [splits, setSplits] = useState<Split[]>(initialSplits);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    supplierId: "",
    createdById: "",
    fineGoldWeightSold: "",
    negotiatedTotalSrd: ""
  });

  useEffect(() => {
    apiRequest<DailyRate>("/rates/latest", "GET")
      .then(setRate)
      .catch(() => setMessage("Cadastre uma taxa diaria antes de operar."));
  }, []);

  const convertedSplit = useMemo(() => {
    const usd = q4(rate?.usdToSrdRate ?? "0");
    const eur = q4(rate?.eurToSrdRate ?? "0");

    return splits.reduce((acc, split) => {
      const amount = q4(split.amount || "0");
      if (split.currency === "SRD") return q4(acc.add(amount));
      if (split.currency === "USD") return q4(acc.add(amount.mul(usd)));
      return q4(acc.add(amount.mul(eur)));
    }, D(0));
  }, [splits, rate?.usdToSrdRate, rate?.eurToSrdRate]);

  const canFinalize = q4(form.negotiatedTotalSrd || "0").equals(q4(convertedSplit)) && !!rate;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (!canFinalize || !rate) {
      setMessage("Split payment deve bater exatamente com o valor negociado.");
      return;
    }

    try {
      await apiRequest("/orders/sale", "POST", {
        supplierId: form.supplierId,
        createdById: form.createdById,
        dailyRateId: rate.id,
        fineGoldWeightSold: format4(form.fineGoldWeightSold || "0"),
        negotiatedTotalSrd: format4(form.negotiatedTotalSrd || "0"),
        paymentSplits: splits.map((split) => ({
          currency: split.currency,
          amount: format4(split.amount || "0")
        }))
      });

      setMessage("Venda finalizada com sucesso.");
      setSplits(initialSplits);
    } catch {
      setMessage("Falha ao finalizar venda.");
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Venda B2B">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              Fornecedor/Comprador (supplierId)
              <input value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required />
            </label>
            <label>
              Operador (createdById)
              <input value={form.createdById} onChange={(e) => setForm({ ...form, createdById: e.target.value })} required />
            </label>
            <label>
              Peso ouro fino vendido (g)
              <input value={form.fineGoldWeightSold} onChange={(e) => setForm({ ...form, fineGoldWeightSold: e.target.value })} required />
            </label>
            <label>
              Valor negociado (SRD)
              <input value={form.negotiatedTotalSrd} onChange={(e) => setForm({ ...form, negotiatedTotalSrd: e.target.value })} required />
            </label>
          </div>

          <SplitPaymentEditor
            splits={splits}
            onChange={setSplits}
            usdToSrdRate={rate?.usdToSrdRate ?? "0"}
            eurToSrdRate={rate?.eurToSrdRate ?? "0"}
            targetSrd={format4(form.negotiatedTotalSrd || "0")}
          />

          <button
            disabled={!canFinalize}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              canFinalize
                ? "bg-emerald-700 text-white hover:bg-emerald-600"
                : "cursor-not-allowed bg-stone-300 text-stone-600"
            }`}
          >
            Finalizar venda
          </button>
        </form>

        {message ? <p className="mt-3 text-sm font-medium text-stone-700">{message}</p> : null}
      </Card>
    </div>
  );
}
