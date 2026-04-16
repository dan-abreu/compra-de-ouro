"use client";

import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";

import { Card } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { format4 } from "@/lib/decimal";

type Entry = {
  id: string;
  kind: "PURCHASE" | "SALE";
  createdAt: string;
  status: "FINALIZED" | "CANCELED";
  physicalWeight: string;
  movementUsd: string;
  movementEur: string;
  movementSrd: string;
  revenueUsd?: string;
  revenueSrd: string;
  costUsd?: string;
  costSrd: string;
  profitUsd?: string;
  profitSrd: string;
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

export default function ExtratoPage() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    apiRequest<Entry[]>("/ledger", "GET")
      .then((rows) => {
        const withMovements = rows.map((row) => ({
          ...row,
          movementUsd: row.kind === "PURCHASE" ? `-${row.costUsd ?? "0.0000"}` : row.revenueUsd ?? "0.0000",
          movementEur: "0.0000",
          movementSrd: row.kind === "PURCHASE" ? `-${row.costSrd}` : row.revenueSrd
        }));
        setEntries(withMovements);
      })
      .catch(() => setEntries([]));
  }, []);

  const orderedEntries = useMemo(() => {
    return [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [entries]);

  const cancelEntry = (id: string) => {
    setEntries((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "CANCELED", profitSrd: "0.0000", profitUsd: "0.0000" } : item
      )
    );
  };

  return (
    <Card title="Extrato (Ledger Statement)">
      <div className="mb-3 flex items-center gap-2 text-xs text-stone-600">
        <span>Historico oficial das ordens registradas e seus efeitos financeiros.</span>
        <HelpHint
          title="Extrato"
          content="Lista compras e vendas por data, com impacto em peso, custo, receita e lucro para auditoria operacional."
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-600">
              <th className="px-2 py-2">Data</th>
              <th className="px-2 py-2">ID</th>
              <th className="px-2 py-2">Tipo</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">+/- Peso (g)</th>
              <th className="px-2 py-2">USD</th>
              <th className="px-2 py-2">EUR</th>
              <th className="px-2 py-2">SRD</th>
              <th className="px-2 py-2">Custo</th>
              <th className="px-2 py-2">Lucro</th>
              <th className="px-2 py-2">
                <span className="inline-flex items-center gap-1">
                  Acoes
                  <HelpHint
                    title="Acoes"
                    content="Permite cancelar a ordem no extrato. Ao cancelar, o status muda para CANCELED e o lucro e zerado na visualizacao."
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orderedEntries.map((row) => (
              <tr key={row.id} className="border-b border-stone-200/70">
                <td className="px-2 py-2">{row.createdAt.slice(0, 10)}</td>
                <td className="px-2 py-2 font-semibold">{row.id}</td>
                <td className="px-2 py-2">{row.kind}</td>
                <td className="px-2 py-2">{row.status}</td>
                <td className="px-2 py-2">{row.kind === "PURCHASE" ? `+${format4(row.physicalWeight)}` : `-${format4(row.physicalWeight)}`}</td>
                <td className="px-2 py-2">{format4(row.movementUsd)}</td>
                <td className="px-2 py-2">{format4(row.movementEur)}</td>
                <td className="px-2 py-2">{format4(row.movementSrd)}</td>
                <td className="px-2 py-2">USD {format4(row.costUsd ?? "0")}</td>
                <td className="px-2 py-2 font-semibold text-emerald-700">USD {format4(row.profitUsd ?? "0")}</td>
                <td className="px-2 py-2">
                  <button
                    className="rounded-lg bg-stone-900 px-2 py-1 text-xs font-semibold text-amber-100 disabled:cursor-not-allowed disabled:bg-stone-300"
                    disabled={row.status === "CANCELED"}
                    onClick={() => cancelEntry(row.id)}
                  >
                    Cancelar ordem
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
