"use client";

import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { format4 } from "@/lib/decimal";

type Entry = {
  id: string;
  kind: "PURCHASE" | "SALE";
  createdAt: string;
  status: "FINALIZED" | "CANCELED";
  fineGoldWeight: string;
  movementUsd: string;
  movementEur: string;
  movementSrd: string;
  revenueSrd: string;
  costSrd: string;
  profitSrd: string;
};

export default function ExtratoPage() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    apiRequest<Entry[]>("/ledger", "GET")
      .then((rows) => {
        const withMovements = rows.map((row) => ({
          ...row,
          movementUsd: "0.0000",
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
      prev.map((item) => (item.id === id ? { ...item, status: "CANCELED", profitSrd: "0.0000" } : item))
    );
  };

  return (
    <Card title="Extrato (Ledger Statement)">
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
              <th className="px-2 py-2">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {orderedEntries.map((row) => (
              <tr key={row.id} className="border-b border-stone-200/70">
                <td className="px-2 py-2">{row.createdAt.slice(0, 10)}</td>
                <td className="px-2 py-2 font-semibold">{row.id}</td>
                <td className="px-2 py-2">{row.kind}</td>
                <td className="px-2 py-2">{row.status}</td>
                <td className="px-2 py-2">{row.kind === "PURCHASE" ? `+${format4(row.fineGoldWeight)}` : `-${format4(row.fineGoldWeight)}`}</td>
                <td className="px-2 py-2">{format4(row.movementUsd)}</td>
                <td className="px-2 py-2">{format4(row.movementEur)}</td>
                <td className="px-2 py-2">{format4(row.movementSrd)}</td>
                <td className="px-2 py-2">{format4(row.costSrd)}</td>
                <td className="px-2 py-2 font-semibold text-emerald-700">{format4(row.profitSrd)}</td>
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
