"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui";
import { ApiError, apiRequest } from "@/lib/apiClient";
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

type CancelDialogState = {
  entry: Entry | null;
  securityPassword: string;
  reason: string;
  submitting: boolean;
  error: string | null;
};

type LocalSettings = {
  requireCancelReason: boolean;
  autoRefreshExtratoSeconds: number;
  compactTables: boolean;
};

const SETTINGS_KEY = "compra_de_ouro.user.settings";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<LocalSettings>({
    requireCancelReason: false,
    autoRefreshExtratoSeconds: 30,
    compactTables: false
  });
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState>({
    entry: null,
    securityPassword: "",
    reason: "",
    submitting: false,
    error: null
  });

  const loadEntries = async () => {
    try {
      setLoading(true);
      setError(null);

      const rows = await apiRequest<Entry[]>("/ledger", "GET");
      const withMovements = rows.map((row) => ({
        ...row,
        movementUsd: row.kind === "PURCHASE" ? `-${row.costUsd ?? "0.0000"}` : row.revenueUsd ?? "0.0000",
        movementEur: "0.0000",
        movementSrd: row.kind === "PURCHASE" ? `-${row.costSrd}` : row.revenueSrd
      }));

      setEntries(withMovements);
    } catch (loadError) {
      if (loadError instanceof ApiError) {
        setError(loadError.message);
      } else {
        setError("Nao foi possivel carregar o extrato.");
      }
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries().catch(() => setError("Nao foi possivel carregar o extrato."));
  }, []);

  useEffect(() => {
    const applySettings = () => {
      try {
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        if (!raw) {
          setSettings({
            requireCancelReason: false,
            autoRefreshExtratoSeconds: 30,
            compactTables: false
          });
          return;
        }

        const parsed = JSON.parse(raw) as Partial<LocalSettings>;
        setSettings({
          requireCancelReason: Boolean(parsed.requireCancelReason),
          autoRefreshExtratoSeconds:
            typeof parsed.autoRefreshExtratoSeconds === "number" ? parsed.autoRefreshExtratoSeconds : 30,
          compactTables: Boolean(parsed.compactTables)
        });
      } catch {
        setSettings({
          requireCancelReason: false,
          autoRefreshExtratoSeconds: 30,
          compactTables: false
        });
      }
    };

    applySettings();
    window.addEventListener("storage", applySettings);
    return () => window.removeEventListener("storage", applySettings);
  }, []);

  useEffect(() => {
    const intervalSeconds = Math.max(5, Math.min(180, Number(settings.autoRefreshExtratoSeconds) || 30));
    const timer = window.setInterval(() => {
      loadEntries().catch(() => {
        // keep current list if refresh fails
      });
    }, intervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [settings.autoRefreshExtratoSeconds]);

  const orderedEntries = useMemo(() => {
    return [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [entries]);

  const totals = useMemo(() => {
    return orderedEntries.reduce(
      (acc, row) => {
        if (row.kind === "PURCHASE") {
          acc.purchaseCount += 1;
        } else {
          acc.saleCount += 1;
        }

        if (row.status === "CANCELED") {
          acc.canceledCount += 1;
        }

        acc.totalProfit += Number(row.profitUsd ?? "0");
        return acc;
      },
      { purchaseCount: 0, saleCount: 0, canceledCount: 0, totalProfit: 0 }
    );
  }, [orderedEntries]);

  const openCancelDialog = (entry: Entry) => {
    setSuccessMessage(null);
    setCancelDialog({
      entry,
      securityPassword: "",
      reason: "",
      submitting: false,
      error: null
    });
  };

  const closeCancelDialog = () => {
    setCancelDialog({
      entry: null,
      securityPassword: "",
      reason: "",
      submitting: false,
      error: null
    });
  };

  const submitCancel = async () => {
    if (!cancelDialog.entry) {
      return;
    }

    if (!cancelDialog.securityPassword.trim()) {
      setCancelDialog((prev) => ({
        ...prev,
        error: "Digite a senha de seguranca para cancelar a ordem."
      }));
      return;
    }

    if (settings.requireCancelReason && !cancelDialog.reason.trim()) {
      setCancelDialog((prev) => ({
        ...prev,
        error: "Esta loja exige motivo no cancelamento."
      }));
      return;
    }

    try {
      setCancelDialog((prev) => ({ ...prev, submitting: true, error: null }));

      const kindPath = cancelDialog.entry.kind === "PURCHASE" ? "purchase" : "sale";
      await apiRequest(`/ledger/${kindPath}/${cancelDialog.entry.id}/cancel`, "POST", {
        securityPassword: cancelDialog.securityPassword,
        reason: cancelDialog.reason
      });

      await loadEntries();
      setSuccessMessage(`Ordem ${cancelDialog.entry.id} cancelada com sucesso.`);
      closeCancelDialog();
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setCancelDialog((prev) => ({
          ...prev,
          submitting: false,
          error: submitError.message
        }));
        return;
      }

      setCancelDialog((prev) => ({
        ...prev,
        submitting: false,
        error: "Nao foi possivel cancelar a ordem."
      }));
    }
  };

  return (
    <>
      <Card title="Extrato Operacional">
        <div className="mb-4 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-orange-50 to-sky-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-700">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 font-semibold">
              <ShieldCheck size={13} />
              Cancelamento protegido por senha
            </span>
            <span>Historico oficial das ordens registradas e seus efeitos financeiros.</span>
            <HelpHint
              title="Extrato"
              content="Lista compras e vendas por data, com impacto em peso, custo, receita e lucro para auditoria operacional."
            />
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl border border-amber-200 bg-white/90 px-3 py-2">
              <p className="text-stone-500">Compras</p>
              <p className="text-lg font-bold text-amber-700">{totals.purchaseCount}</p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-white/90 px-3 py-2">
              <p className="text-stone-500">Vendas</p>
              <p className="text-lg font-bold text-sky-700">{totals.saleCount}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-white/90 px-3 py-2">
              <p className="text-stone-500">Canceladas</p>
              <p className="text-lg font-bold text-rose-700">{totals.canceledCount}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white/90 px-3 py-2">
              <p className="text-stone-500">Lucro total (USD)</p>
              <p className="text-lg font-bold text-emerald-700">{format4(totals.totalProfit)}</p>
            </div>
          </div>
        </div>

        {successMessage ? (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/85">
          <table className={`min-w-full ${settings.compactTables ? "text-xs" : "text-sm"}`}>
            <thead>
              <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-sky-50 text-left text-xs uppercase tracking-wide text-slate-600">
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
                      content="Para cancelar qualquer ordem e obrigatorio informar a senha de cancelamento definida pelo admin da loja."
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-sm text-slate-500">
                    Carregando extrato...
                  </td>
                </tr>
              ) : orderedEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-sm text-slate-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                orderedEntries.map((row) => {
                  const statusClasses =
                    row.status === "CANCELED"
                      ? "bg-rose-100 text-rose-700 border border-rose-200"
                      : "bg-emerald-100 text-emerald-700 border border-emerald-200";

                  return (
                    <tr key={row.id} className="border-b border-slate-200/70 transition hover:bg-slate-50/80">
                      <td className="px-2 py-2">{row.createdAt.slice(0, 10)}</td>
                      <td className="px-2 py-2 font-semibold">{row.id}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                            row.kind === "PURCHASE"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          {row.kind}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusClasses}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {row.kind === "PURCHASE"
                          ? `+${format4(row.physicalWeight)}`
                          : `-${format4(row.physicalWeight)}`}
                      </td>
                      <td className="px-2 py-2 font-medium">{format4(row.movementUsd)}</td>
                      <td className="px-2 py-2">{format4(row.movementEur)}</td>
                      <td className="px-2 py-2">{format4(row.movementSrd)}</td>
                      <td className="px-2 py-2">USD {format4(row.costUsd ?? "0")}</td>
                      <td className="px-2 py-2 font-semibold text-emerald-700">USD {format4(row.profitUsd ?? "0")}</td>
                      <td className="px-2 py-2">
                        <button
                          className="rounded-lg bg-gradient-to-r from-slate-900 to-slate-700 px-2 py-1 text-xs font-semibold text-amber-100 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300"
                          disabled={row.status === "CANCELED"}
                          onClick={() => openCancelDialog(row)}
                        >
                          Cancelar ordem
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {cancelDialog.entry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start gap-3">
              <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Confirmar cancelamento</h3>
                <p className="text-sm text-slate-600">
                  Ordem <strong>{cancelDialog.entry.id}</strong> ({cancelDialog.entry.kind}) sera cancelada.
                </p>
              </div>
            </div>

            <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              Use a senha de cancelamento criada pelo admin. Operadores podem cancelar usando essa senha.
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Senha de seguranca</label>
                <input
                  type="password"
                  value={cancelDialog.securityPassword}
                  onChange={(event) =>
                    setCancelDialog((prev) => ({ ...prev, securityPassword: event.target.value, error: null }))
                  }
                  placeholder="Digite a senha definida pelo admin"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Motivo (opcional)</label>
                <textarea
                  value={cancelDialog.reason}
                  onChange={(event) => setCancelDialog((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder="Descreva o motivo do cancelamento"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                />
              </div>

              {cancelDialog.error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {cancelDialog.error}
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  onClick={closeCancelDialog}
                  disabled={cancelDialog.submitting}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-rose-600 to-red-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => submitCancel()}
                  disabled={cancelDialog.submitting}
                >
                  {cancelDialog.submitting ? "Cancelando..." : "Confirmar cancelamento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
