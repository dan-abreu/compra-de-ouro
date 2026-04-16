"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";

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

function HelpHint({ title, content }: { title: string; content: string }) {
  return (
    <span className="group relative inline-flex">
      <span
        className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-500"
        aria-label={`Ajuda: ${title}`}
        title={title}
      >
        <Info size={11} />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-stone-200 bg-white p-3 text-[11px] leading-relaxed text-stone-600 shadow-xl group-hover:block group-focus-within:block">
        <strong className="mb-1 block text-xs text-stone-800">{title}</strong>
        {content}
      </span>
    </span>
  );
}

export function DashboardClient() {
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
          <div className="mb-3 flex items-center gap-2 text-xs text-stone-600">
            <span>Posicao atual de caixa e ouro da operacao.</span>
            <HelpHint
              title="Saldo do Cofre"
              content="Mostra os saldos atuais em ouro, SRD, USD e EUR para decisao rapida no balcao."
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <LabeledValue label="Ouro fisico (g)" value={format4(vault?.balanceGoldGrams ?? "0")} />
            <LabeledValue label="SRD" value={format4(vault?.balanceSrd ?? "0")} />
            <LabeledValue label="USD" value={format4(vault?.balanceUsd ?? "0")} />
            <LabeledValue label="EUR" value={format4(vault?.balanceEur ?? "0")} />
          </div>
        </Card>

        <Card title="Ouro em Aberto">
          <div className="mb-3 flex items-center gap-2 text-xs text-stone-600">
            <span>Controle de risco do ouro ainda nao encerrado.</span>
            <HelpHint
              title="Ouro em Aberto"
              content="Exibe quantidade e custo do ouro que ainda nao foi totalmente compensado por venda."
            />
          </div>
          <div className="space-y-2 text-sm">
            <p><strong>Peso em aberto:</strong> {format4(vault?.openGoldGrams ?? "0")} g</p>
            <p><strong>Custo em aberto:</strong> USD {format4(vault?.openGoldAcquisitionCostUsd ?? "0")}</p>
          </div>
        </Card>

        <Card title="Snapshot Atual">
          <div className="mb-3 flex items-center gap-2 text-xs text-stone-600">
            <span>Taxas de referencia para precificacao.</span>
            <HelpHint
              title="Snapshot Atual"
              content="Mostra preco do ouro e cambio do dia para orientar compra, venda e rateio multimoeda."
            />
          </div>
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
