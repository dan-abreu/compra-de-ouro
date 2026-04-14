"use client";

import { useEffect, useState } from "react";

import { Card, LabeledValue } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { format4 } from "@/lib/decimal";

type Vault = {
  balanceGoldGrams: string;
  openGoldGrams: string;
  openGoldAcquisitionCostUsd: string;
  balanceSrd: string;
  balanceUsd: string;
  balanceEur: string;
};

type DailyRate = {
  id: string;
  rateDate: string;
  goldPricePerGramUsd: string;
  usdToSrdRate: string;
  eurToUsdRate: string;
};

export default function DashboardPage() {
  const [vault, setVault] = useState<Vault | null>(null);
  const [rate, setRate] = useState<DailyRate | null>(null);
  const [message, setMessage] = useState("");

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

  return (
    <div className="space-y-4">
      {message ? <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">{message}</p> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Saldo do Cofre">
          <div className="grid gap-3 md:grid-cols-2">
            <LabeledValue label="Ouro fisico (g)" value={format4(vault?.balanceGoldGrams ?? "0")} />
            <LabeledValue label="SRD" value={format4(vault?.balanceSrd ?? "0")} />
            <LabeledValue label="USD" value={format4(vault?.balanceUsd ?? "0")} />
            <LabeledValue label="EUR" value={format4(vault?.balanceEur ?? "0")} />
          </div>
        </Card>

        <Card title="Ouro em Aberto">
          <div className="space-y-2 text-sm">
            <p><strong>Peso em aberto:</strong> {format4(vault?.openGoldGrams ?? "0")} g</p>
            <p><strong>Custo em aberto:</strong> USD {format4(vault?.openGoldAcquisitionCostUsd ?? "0")}</p>
          </div>
        </Card>

        <Card title="Snapshot Atual">
          <div className="space-y-2 text-sm">
            <p><strong>Data:</strong> {rate?.rateDate?.slice(0, 10) ?? "-"}</p>
            <p><strong>Ouro por grama (USD):</strong> {format4(rate?.goldPricePerGramUsd ?? "0")}</p>
            <p><strong>USD {"->"} SRD:</strong> {format4(rate?.usdToSrdRate ?? "0")}</p>
            <p><strong>EUR {"->"} USD:</strong> {format4(rate?.eurToUsdRate ?? "0")}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
