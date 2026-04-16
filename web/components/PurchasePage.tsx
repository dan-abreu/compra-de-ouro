"use client";

import Decimal from "decimal.js";
import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";

import { TradePartyOption, TradePartySelector } from "@/components/TradePartySelector";
import { TreasurySplitPlanner } from "@/components/TreasurySplitPlanner";
import { Card, LabeledValue } from "@/components/ui";
import { ApiError, apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { AML_KYC_THRESHOLD_USD, REQUIRE_KYC_ABOVE_10K } from "@/lib/complianceConfig";
import { format4 } from "@/lib/decimal";
import {
  ZERO,
  buildAmountAlert,
  calculatePaymentPreview,
  calculateTotalAmountUsd,
  createAutofilledPaymentLine,
  decimalText,
  normalizeLineByAmount,
  normalizeLineByPercentage,
  parseDecimal,
  PaymentLine,
  syncLineWithTotal
} from "@/lib/treasury";

type DailyRate = {
  rateDate: string;
  goldPricePerGramUsd: string;
  usdToSrdRate: string;
  eurToUsdRate: string;
  fetchedAt?: string;
  sourceMode?: "external-live" | "database-cached" | "manual-input";
  sources?: Array<{
    symbol: string;
    provider: string;
    url: string;
    note: string;
  }>;
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

export function PurchasePage() {
  const auth = useAuthStore();
  type PurchasePayload = {
    clientId?: string;
    isWalkIn: boolean;
    goldState: "BURNED" | "MELTED";
    physicalWeight: string;
    purityPercentage: string;
    negotiatedPricePerGram: string;
    totalOrderValueUsd: string;
    paymentSplits: Array<{
      currency: string;
      amount: string;
      manualExchangeRate?: string;
    }>;
  };

  type PurchaseAuditPayload = {
    clientId?: string;
    isWalkIn: boolean;
    goldState: "BURNED" | "MELTED";
    physicalWeight: string;
    purityPercentage: string;
    negotiatedPricePerGram: string;
    totalOrderValueUsd: string;
    paymentSplits: Array<{
      currency: string;
      splitPercentage: string;
      splitAmountUsd: string;
      manualExchangeRate: string | null;
      settlementAmount: string;
    }>;
  };

  const [goldState, setGoldState] = useState<"BURNED" | "MELTED">("BURNED");
  const [selectedClient, setSelectedClient] = useState<TradePartyOption | null>(null);
  const [clientCount, setClientCount] = useState(0);
  const [rate, setRate] = useState<DailyRate | null>(null);
  const [message, setMessage] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<null | "compliance" | "receipt">(null);
  const [pendingPayload, setPendingPayload] = useState<PurchasePayload | null>(null);
  const [pendingAuditPayload, setPendingAuditPayload] = useState<PurchaseAuditPayload | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    physicalWeight: "",
    purityPercentage: "",
    negotiatedPricePerGramUsd: ""
  });
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([createAutofilledPaymentLine(1, null, ZERO, [])]);

  useEffect(() => {
    const load = async () => {
      try {
        const latestRate = await apiRequest<DailyRate>("/rates/market-live", "GET");
        setRate(latestRate);
        setPaymentLines([createAutofilledPaymentLine(1, latestRate, ZERO, [])]);
      } catch {
        setRate(null);
        setPaymentLines([createAutofilledPaymentLine(1, null, ZERO, [])]);
      } finally {
        setLoading(false);
      }
    };

    load().catch(() => setLoading(false));
  }, []);

  const negotiatedPricePerGramUsd = useMemo(() => parseDecimal(form.negotiatedPricePerGramUsd), [form.negotiatedPricePerGramUsd]);
  const calculatedOrderValueUsd = useMemo(
    () => parseDecimal(form.physicalWeight).mul(negotiatedPricePerGramUsd).toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
    [form.physicalWeight, negotiatedPricePerGramUsd]
  );
  const totalOrderValueUsd = useMemo(() => calculatedOrderValueUsd, [calculatedOrderValueUsd]);
  const paymentPreview = useMemo(() => calculatePaymentPreview(paymentLines, totalOrderValueUsd), [paymentLines, totalOrderValueUsd]);
  const totalSplitAmountUsd = useMemo(() => calculateTotalAmountUsd(paymentLines), [paymentLines]);
  const splitDeltaUsd = useMemo(() => totalOrderValueUsd.sub(totalSplitAmountUsd).toDecimalPlaces(4, Decimal.ROUND_HALF_UP), [totalOrderValueUsd, totalSplitAmountUsd]);
  const amountAlert = useMemo(() => buildAmountAlert(totalSplitAmountUsd, totalOrderValueUsd), [totalSplitAmountUsd, totalOrderValueUsd]);

  useEffect(() => {
    setPaymentLines((current) => current.map((line) => syncLineWithTotal(line, totalOrderValueUsd)));
  }, [totalOrderValueUsd]);

  const hasSplitErrors = paymentPreview.some((line) => line.error !== null);
  const needsSoftComplianceWarning = isWalkIn && totalOrderValueUsd.gte(AML_KYC_THRESHOLD_USD);
  const complianceBlocked = needsSoftComplianceWarning && REQUIRE_KYC_ABOVE_10K;
  const canFinalize =
    splitDeltaUsd.eq(ZERO) &&
    !hasSplitErrors &&
    (isWalkIn || form.clientId.trim() !== "") &&
    form.physicalWeight.trim() !== "" &&
    form.purityPercentage.trim() !== "" &&
    form.negotiatedPricePerGramUsd.trim() !== "" &&
    totalOrderValueUsd.gt(0) &&
    !complianceBlocked;

  const validateOrder = () => {
    if (complianceBlocked) {
      setGlobalError("KYC obrigatorio para avulso acima de USD 10.000,00 com a politica atual.");
      return false;
    }

    if (!canFinalize) {
      setGlobalError("A compra so pode ser finalizada quando a soma exata dos splits em USD fechar o total da ordem e todos os campos obrigatorios estiverem preenchidos.");
      return false;
    }

    return true;
  };

  const buildPayloads = (): { normalizedPayload: PurchasePayload; treasuryAuditPayload: PurchaseAuditPayload } => {
    const normalizedPayload: PurchasePayload = {
      clientId: isWalkIn ? undefined : form.clientId,
      isWalkIn,
      goldState,
      physicalWeight: format4(form.physicalWeight),
      purityPercentage: format4(form.purityPercentage),
      negotiatedPricePerGram: format4(form.negotiatedPricePerGramUsd),
      totalOrderValueUsd: decimalText(totalOrderValueUsd),
      paymentSplits: paymentLines.map((line) => {
        const preview = paymentPreview.find((item) => item.id === line.id);
        return {
          currency: line.currency,
          amount: preview ? decimalText(preview.settlementAmount) : "0.0000",
          manualExchangeRate: line.currency === "USD" ? undefined : format4(line.manualExchangeRate || "0")
        };
      })
    };

    const treasuryAuditPayload: PurchaseAuditPayload = {
      ...normalizedPayload,
      totalOrderValueUsd: decimalText(totalOrderValueUsd),
      paymentSplits: paymentLines.map((line) => {
        const preview = paymentPreview.find((item) => item.id === line.id);
        return {
          currency: line.currency,
          splitPercentage: format4(line.splitPercentage || "0"),
          splitAmountUsd: format4(line.splitAmountUsd || "0"),
          manualExchangeRate: line.currency === "USD" ? null : format4(line.manualExchangeRate || "0"),
          settlementAmount: preview ? decimalText(preview.settlementAmount) : "0.0000"
        };
      })
    };

    return { normalizedPayload, treasuryAuditPayload };
  };

  const confirmAndSubmit = async () => {
    if (!pendingPayload) {
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest("/orders/purchase", "POST", pendingPayload);
      setMessage("Compra finalizada com sucesso.");
      resetForm();
    } catch (error) {
      if (error instanceof ApiError) {
        setGlobalError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setGlobalError("Falha ao finalizar compra.");
      }
    } finally {
      setSubmitting(false);
      setActiveModal(null);
      setPendingPayload(null);
      setPendingAuditPayload(null);
    }
  };

  const setLine = (lineId: string, field: keyof PaymentLine, value: string) => {
    setPaymentLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        if (field === "splitPercentage") {
          return normalizeLineByPercentage({ ...line, splitPercentage: value }, totalOrderValueUsd);
        }

        if (field === "splitAmountUsd") {
          return normalizeLineByAmount({ ...line, splitAmountUsd: value }, totalOrderValueUsd);
        }

        return { ...line, [field]: value };
      })
    );
  };

  const addLine = () => {
    setPaymentLines((current) => [...current, createAutofilledPaymentLine(current.length + 1, rate, totalOrderValueUsd, current)]);
  };

  const removeLine = (lineId: string) => {
    setPaymentLines((current) => (current.length === 1 ? current : current.filter((line) => line.id !== lineId)));
  };

  const resetForm = () => {
    setForm({
      clientId: "",
      physicalWeight: "",
      purityPercentage: "",
      negotiatedPricePerGramUsd: ""
    });
    setSelectedClient(null);
    setIsWalkIn(false);
    setPaymentLines([createAutofilledPaymentLine(1, rate, ZERO, [])]);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setGlobalError("");
    setFieldErrors({});

    if (!validateOrder()) {
      return;
    }

    const { normalizedPayload, treasuryAuditPayload } = buildPayloads();
    setPendingPayload(normalizedPayload);
    setPendingAuditPayload(treasuryAuditPayload);

    console.log("PurchaseOrderService payload", treasuryAuditPayload);

    setActiveModal(needsSoftComplianceWarning ? "compliance" : "receipt");
  };

  const fieldError = (field: string) => fieldErrors[field];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <Card title="Mesa de Compra">
          <form onSubmit={submit} className="space-y-5">
            {globalError ? <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{globalError}</div> : null}
            {message ? <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
            <div className="rounded-2xl border border-stone-300/70 bg-stone-50 p-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Contraparte da Compra</p>
                      <HelpHint
                        title="Contraparte da Compra"
                        content="Selecione quem esta vendendo ouro para a loja. Se nao for cadastrado, ative Cliente Avulso."
                      />
                    </div>
                    <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800">
                      <input
                        type="checkbox"
                        checked={isWalkIn}
                        onChange={(event) => {
                          setIsWalkIn(event.target.checked);
                          if (event.target.checked) {
                            setForm((current) => ({ ...current, clientId: "" }));
                            setSelectedClient(null);
                          }
                        }}
                      />
                      Cliente Avulso
                      <HelpHint
                        title="Cliente Avulso"
                        content="Use quando a pessoa nao tem cadastro. Dependendo do valor, pode exigir validacao de compliance."
                      />
                    </label>
                  </div>
                  <TradePartySelector
                    type="CLIENT"
                    label="Cliente"
                    value={form.clientId}
                    disabled={isWalkIn}
                    placeholder={isWalkIn ? "Cliente Avulso" : "Buscar cliente"}
                    emptyText="Nenhum cliente encontrado."
                    errorMessage={fieldError("clientId")}
                    onOptionsLoaded={setClientCount}
                    onChange={(option) => {
                      setSelectedClient(option);
                      setForm((current) => ({ ...current, clientId: option?.id ?? "" }));
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-300/70 bg-stone-50 p-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Estado Fisico do Ouro</p>
                <HelpHint
                  title="Estado Fisico do Ouro"
                  content="Classifica o tipo de material recebido na compra, para controle de estoque e apuracao financeira."
                />
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800">
                  <input type="radio" name="goldStatePurchase" checked={goldState === "BURNED"} onChange={() => setGoldState("BURNED")} />
                  Ouro Queimado
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800">
                  <input type="radio" name="goldStatePurchase" checked={goldState === "MELTED"} onChange={() => setGoldState("MELTED")} />
                  Ouro Fundido
                </label>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-medium text-stone-700">
                <span className="mb-1 flex items-center gap-2">
                  <span>{goldState === "BURNED" ? "Peso do Ouro Queimado (g)" : "Peso do Ouro Fundido (g)"}</span>
                  <HelpHint
                    title="Peso do Ouro"
                    content="Peso fisico medido da peca. Esse valor, junto com preco por grama, define o total da ordem."
                  />
                </span>
                <input value={form.physicalWeight} onChange={(event) => setForm({ ...form, physicalWeight: event.target.value })} required />
                {fieldError("physicalWeight") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("physicalWeight")}</p> : null}
              </label>
              <label className="text-xs font-medium text-stone-700">
                <span className="mb-1 flex items-center gap-2">
                  <span>Teor de Pureza (%)</span>
                  <HelpHint
                    title="Teor de Pureza"
                    content="Percentual de pureza informado na negociacao. Mantem historico tecnico e auditoria da compra."
                  />
                </span>
                <input value={form.purityPercentage} onChange={(event) => setForm({ ...form, purityPercentage: event.target.value })} required />
                {fieldError("purityPercentage") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("purityPercentage")}</p> : null}
              </label>
              <label className="text-xs font-medium text-stone-700">
                <span className="mb-1 flex items-center gap-2">
                  <span>Preco da Grama da Ordem (USD)</span>
                  <HelpHint
                    title="Preco da Grama"
                    content="Preco negociado desta operacao. Pode seguir o spot do mercado ou um valor ajustado na negociacao."
                  />
                </span>
                <input
                  value={form.negotiatedPricePerGramUsd}
                  onChange={(event) => setForm({ ...form, negotiatedPricePerGramUsd: event.target.value })}
                  required
                />
                <p className="mt-1 text-xs text-stone-600">Use o preço da bolsa no painel da direita como referência e ajuste para esta ordem.</p>
                {fieldError("negotiatedPricePerGram") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("negotiatedPricePerGram")}</p> : null}
              </label>
            </div>

            {needsSoftComplianceWarning ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Compliance: cliente avulso acima de USD 10.000,00.</p>
                <p className="mt-1 text-xs">
                  {REQUIRE_KYC_ABOVE_10K
                    ? "Politica atual exige KYC e bloqueia finalizacao sem cadastro."
                    : "Politica atual permite finalizar com override de compliance registrado automaticamente."}
                </p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-stone-300/70 bg-stone-950 p-4 text-stone-100">
              <div className="grid gap-3 md:grid-cols-2">
                <LabeledValue label="Preço Negociado por Grama" value={`USD ${decimalText(negotiatedPricePerGramUsd)}`} />
                <LabeledValue label="Valor Total da Ordem (USD)" value={`USD ${decimalText(totalOrderValueUsd)}`} />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-600">
              <span>Rateio de Tesouraria</span>
              <HelpHint
                title="Rateio de Tesouraria"
                content="Divida o valor total entre moedas e taxas. A compra so fecha quando a soma em USD bate exatamente o total da ordem."
              />
            </div>

            <TreasurySplitPlanner
              paymentLines={paymentLines}
              paymentPreview={paymentPreview}
              amountAlert={amountAlert}
              rate={rate}
              settlementLabel="Valor Calculado no Caixa"
              helperText="Cada linha já inicia com a cotação diária sugerida, mas permanece totalmente editável pelo operador."
              onAdd={addLine}
              onRemove={removeLine}
              onSetLine={setLine}
            />
            {fieldError("paymentSplits") ? <p className="-mt-2 text-xs font-semibold text-red-700">{fieldError("paymentSplits")}</p> : null}

            <button disabled={submitting} className={`rounded-2xl px-5 py-3 text-sm font-semibold ${!submitting ? "bg-emerald-700 text-white hover:bg-emerald-600" : "cursor-not-allowed bg-stone-300 text-stone-600"}`}>
              {submitting ? "Processando Transacao..." : "Finalizar Compra"}
            </button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card title="Snapshot de Mercado">
            <div className="mb-3 flex items-center gap-2 text-xs text-stone-600">
              <span>Referencias de preco e cambio para apoiar a negociacao.</span>
              <HelpHint
                title="Snapshot de Mercado"
                content="Mostra as cotacoes atuais usadas como referencia. O operador pode negociar valores diferentes na ordem."
              />
            </div>
            <div className="grid gap-3">
              <LabeledValue label="Preço da Grama (USD) em Tempo Real" value={`USD ${rate ? format4(rate.goldPricePerGramUsd) : "0.0000"}`} />
              <LabeledValue label="Taxa USD para SRD" value={rate ? format4(rate.usdToSrdRate) : "0.0000"} />
              <LabeledValue label="Taxa EUR para USD" value={rate ? format4(rate.eurToUsdRate) : "0.0000"} />
              <LabeledValue label="Atualizado em" value={rate?.fetchedAt ? new Date(rate.fetchedAt).toLocaleString("pt-BR") : "-"} />
              <LabeledValue
                label="Origem"
                value={
                  rate?.sourceMode === "external-live"
                    ? "Bolsa/API externa ao vivo"
                    : rate?.sourceMode === "manual-input"
                      ? "Contingencia operacional"
                      : rate
                        ? "Fallback base local"
                        : "-"
                }
              />
            </div>
          </Card>

          <Card title="Resumo Operacional">
            <div className="mb-3 flex items-center gap-2 text-xs text-stone-600">
              <span>Painel de conferencia rapida antes de finalizar.</span>
              <HelpHint
                title="Resumo Operacional"
                content="Checklist rapido com contraparte, modo da ordem e status do rateio para evitar erro de fechamento."
              />
            </div>
            <div className="space-y-3 text-sm text-stone-700">
              <p><strong>Clientes carregados:</strong> {loading ? "carregando" : clientCount}</p>
              <p><strong>Modo da ordem:</strong> {isWalkIn ? "Cliente Avulso" : "Cliente cadastrado"}</p>
              <p><strong>Cliente selecionado:</strong> {selectedClient?.displayName ?? "-"}</p>
              <p><strong>Origem declarada:</strong> {selectedClient?.goldOrigin ?? "-"}</p>
              <p><strong>Linhas de payout:</strong> {paymentLines.length}</p>
              <p><strong>Status do rateio:</strong> {splitDeltaUsd.eq(ZERO) ? "Fechado no valor exato" : "Aguardando ajuste de centavos"}</p>
            </div>
          </Card>
        </div>
      </div>

      {activeModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-stone-300 bg-white p-5 shadow-2xl">
            {activeModal === "compliance" ? (
              <>
                <h3 className="font-heading text-lg font-semibold text-stone-900">Atenção de Compliance</h3>
                <p className="mt-2 text-sm text-stone-700">
                  Esta compra está acima de USD 10.000,00 em modo avulso. Deseja continuar para conferência final ou cancelar agora?
                </p>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                    onClick={() => {
                      setActiveModal(null);
                      setPendingPayload(null);
                      setPendingAuditPayload(null);
                    }}
                  >
                    Cancelar operação
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                    onClick={() => setActiveModal("receipt")}
                  >
                    Continuar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-heading text-lg font-semibold text-stone-900">Recibo de Conferência da Compra</h3>
                <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
                  <p><strong>Operador:</strong> {auth.userName ?? "-"}</p>
                  <p><strong>Contraparte:</strong> {isWalkIn ? "Cliente Avulso" : selectedClient?.displayName ?? "-"}</p>
                  <p><strong>Estado do ouro:</strong> {pendingAuditPayload?.goldState ?? "-"}</p>
                  <p><strong>Peso:</strong> {pendingAuditPayload?.physicalWeight ?? "-"} g</p>
                  <p><strong>Pureza:</strong> {pendingAuditPayload?.purityPercentage ?? "-"} %</p>
                  <p><strong>Preço por grama:</strong> USD {pendingAuditPayload?.negotiatedPricePerGram ?? "-"}</p>
                  <p><strong>Total da ordem:</strong> USD {pendingAuditPayload?.totalOrderValueUsd ?? "-"}</p>
                  <div>
                    <p className="mb-2 font-semibold text-stone-800">Rateio de pagamento</p>
                    <div className="space-y-2">
                      {pendingAuditPayload?.paymentSplits.map((line, idx) => (
                        <div key={`${line.currency}-${idx}`} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs">
                          <p><strong>Moeda:</strong> {line.currency}</p>
                          <p><strong>%:</strong> {line.splitPercentage}</p>
                          <p><strong>USD:</strong> {line.splitAmountUsd}</p>
                          <p><strong>Liquidação:</strong> {line.settlementAmount}</p>
                          <p><strong>Câmbio manual:</strong> {line.manualExchangeRate ?? "-"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                    onClick={() => {
                      setActiveModal(null);
                      setPendingPayload(null);
                      setPendingAuditPayload(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-stone-300"
                    onClick={() => {
                      confirmAndSubmit().catch(() => undefined);
                    }}
                  >
                    {submitting ? "Confirmando..." : "Confirmar e finalizar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}