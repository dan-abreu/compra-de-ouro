"use client";

import { useEffect, useState } from "react";

import { Card, LabeledValue } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { format4 } from "@/lib/decimal";

type Vault = {
  physicalGoldFineWeight: string;
  openGoldFineWeight: string;
  openGoldAcquisitionCostSrd: string;
  balanceSrd: string;
  balanceUsd: string;
  balanceEur: string;
};

type DailyRate = {
  id: string;
  rateDate: string;
  goldPricePerGram: string;
  usdToSrdRate: string;
  eurToSrdRate: string;
};

export default function DashboardPage() {
  const [vault, setVault] = useState<Vault | null>(null);
  const [rate, setRate] = useState<DailyRate | null>(null);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    rateDate: new Date().toISOString().slice(0, 10),
    createdById: "",
    goldPricePerGram: "",
    usdToSrdRate: "",
    eurToSrdRate: ""
  });

  const load = async () => {
    const [vaultData, latestRate] = await Promise.all([
      apiRequest<Vault>("/vault", "GET"),
      apiRequest<DailyRate>("/rates/latest", "GET").catch(() => null)
    ]);

    setVault(vaultData);
    setRate(latestRate);
  };

  useEffect(() => {
    load().catch(() => setMessage("Nao foi possivel carregar dados iniciais."));
  }, []);

  const submitRate = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");

    try {
      await apiRequest("/rates", "POST", form);
      setMessage("Taxa do dia registrada com sucesso.");
      await load();
    } catch {
      setMessage("Falha ao salvar taxa do dia.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Saldo do Cofre">
          <div className="grid gap-3 md:grid-cols-2">
            <LabeledValue label="Ouro fisico (g fino)" value={format4(vault?.physicalGoldFineWeight ?? "0")} />
            <LabeledValue label="SRD" value={format4(vault?.balanceSrd ?? "0")} />
            <LabeledValue label="USD" value={format4(vault?.balanceUsd ?? "0")} />
            <LabeledValue label="EUR" value={format4(vault?.balanceEur ?? "0")} />
          </div>
        </Card>

        <Card title="Ouro em Aberto">
          <div className="space-y-2 text-sm">
            <p><strong>Peso em aberto:</strong> {format4(vault?.openGoldFineWeight ?? "0")} g</p>
            <p><strong>Custo em aberto:</strong> SRD {format4(vault?.openGoldAcquisitionCostSrd ?? "0")}</p>
          </div>
        </Card>

        <Card title="Snapshot Atual">
          <div className="space-y-2 text-sm">
            <p><strong>Data:</strong> {rate?.rateDate?.slice(0, 10) ?? "-"}</p>
            <p><strong>Ouro por grama:</strong> {format4(rate?.goldPricePerGram ?? "0")}</p>
            <p><strong>USD {"->"} SRD:</strong> {format4(rate?.usdToSrdRate ?? "0")}</p>
            <p><strong>EUR {"->"} SRD:</strong> {format4(rate?.eurToSrdRate ?? "0")}</p>
          </div>
        </Card>
      </div>

      <Card title="Atualizar Taxas Manuais do Dia (Admin)">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submitRate}>
          <label>
            Data
            <input
              type="date"
              value={form.rateDate}
              onChange={(event) => setForm({ ...form, rateDate: event.target.value })}
            />
          </label>

          <label>
            ID do Admin (createdById)
            <input
              type="text"
              value={form.createdById}
              onChange={(event) => setForm({ ...form, createdById: event.target.value })}
              placeholder="user_id"
              required
            />
          </label>

          <label>
            Preco ouro por grama
            <input
              type="text"
              value={form.goldPricePerGram}
              onChange={(event) => setForm({ ...form, goldPricePerGram: event.target.value })}
              placeholder="0.0000"
              required
            />
          </label>

          <label>
            USD {"->"} SRD
            <input
              type="text"
              value={form.usdToSrdRate}
              onChange={(event) => setForm({ ...form, usdToSrdRate: event.target.value })}
              placeholder="0.0000"
              required
            />
          </label>

          <label className="md:col-span-2">
            EUR {"->"} SRD
            <input
              type="text"
              value={form.eurToSrdRate}
              onChange={(event) => setForm({ ...form, eurToSrdRate: event.target.value })}
              placeholder="0.0000"
              required
            />
          </label>

          <button className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-stone-700 md:col-span-2">
            Salvar taxa
          </button>
        </form>
        {message ? <p className="mt-3 text-sm font-medium text-stone-700">{message}</p> : null}
      </Card>
    </div>
  );
}
