"use client";

import { useEffect, useMemo, useState } from "react";

import { Split, SplitPaymentEditor } from "@/components/split-payment";
import { Card } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { D, format4, q4 } from "@/lib/decimal";

type DailyRate = {
  id: string;
  goldPricePerGram: string;
  usdToSrdRate: string;
  eurToSrdRate: string;
};

const initialSplits: Split[] = [{ currency: "SRD", amount: "" }];

export default function CompraPage() {
  const [rate, setRate] = useState<DailyRate | null>(null);
  const [splits, setSplits] = useState<Split[]>(initialSplits);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    clientId: "",
    createdById: "",
    grossWeight: "",
    netWeight: "",
    purityPercentage: ""
  });

  useEffect(() => {
    apiRequest<DailyRate>("/rates/latest", "GET")
      .then(setRate)
      .catch(() => setMessage("Cadastre uma taxa diaria antes de operar."));
  }, []);

  const fineGoldWeight = useMemo(() => {
    return q4(form.netWeight || "0").mul(q4(form.purityPercentage || "0").div(100));
  }, [form.netWeight, form.purityPercentage]);

  const totalSrd = useMemo(() => {
    const goldPrice = q4(rate?.goldPricePerGram ?? "0");
    return q4(fineGoldWeight.mul(goldPrice));
  }, [fineGoldWeight, rate?.goldPricePerGram]);

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

  const canFinalize = q4(totalSrd).equals(q4(convertedSplit)) && !!rate;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (!canFinalize || !rate) {
      setMessage("Split payment deve bater exatamente com o valor da compra.");
      return;
    }

    try {
      await apiRequest("/orders/purchase", "POST", {
        clientId: form.clientId,
        createdById: form.createdById,
        dailyRateId: rate.id,
        grossWeight: format4(form.grossWeight || "0"),
        netWeight: format4(form.netWeight || "0"),
        purityPercentage: format4(form.purityPercentage || "0"),
        paymentSplits: splits.map((split) => ({
          currency: split.currency,
          amount: format4(split.amount || "0")
        }))
      });

      setMessage("Compra finalizada com sucesso.");
      setSplits(initialSplits);
    } catch {
      setMessage("Falha ao finalizar compra.");
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Compra POS">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              Cliente (clientId)
              <input value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required />
            </label>
            <label>
              Operador (createdById)
              <input value={form.createdById} onChange={(e) => setForm({ ...form, createdById: e.target.value })} required />
            </label>
            <label>
              Peso bruto (g)
              <input value={form.grossWeight} onChange={(e) => setForm({ ...form, grossWeight: e.target.value })} required />
            </label>
            <label>
              Peso liquido (g)
              <input value={form.netWeight} onChange={(e) => setForm({ ...form, netWeight: e.target.value })} required />
            </label>
            <label className="md:col-span-2">
              Pureza (%)
              <input value={form.purityPercentage} onChange={(e) => setForm({ ...form, purityPercentage: e.target.value })} required />
            </label>
          </div>

          <div className="rounded-xl border border-stone-300 bg-white/85 p-3 text-sm">
            <p>Peso ouro fino calculado: <strong>{format4(fineGoldWeight)}</strong> g</p>
            <p>Valor total snapshot: <strong>SRD {format4(totalSrd)}</strong></p>
          </div>

          <SplitPaymentEditor
            splits={splits}
            onChange={setSplits}
            usdToSrdRate={rate?.usdToSrdRate ?? "0"}
            eurToSrdRate={rate?.eurToSrdRate ?? "0"}
            targetSrd={format4(totalSrd)}
          />

          <button
            disabled={!canFinalize}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              canFinalize
                ? "bg-emerald-700 text-white hover:bg-emerald-600"
                : "cursor-not-allowed bg-stone-300 text-stone-600"
            }`}
          >
            Finalizar compra
          </button>
        </form>

        {message ? <p className="mt-3 text-sm font-medium text-stone-700">{message}</p> : null}
      </Card>
    </div>
  );
}
