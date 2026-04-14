"use client";

import Decimal from "decimal.js";
import { useEffect, useMemo, useState } from "react";

import { PriceSuggestionBreakdown } from "@/components/PriceSuggestionBreakdown";
import { TradePartyOption, TradePartySelector } from "@/components/TradePartySelector";
import { TreasurySplitPlanner } from "@/components/TreasurySplitPlanner";
import { Card, LabeledValue } from "@/components/ui";
import { ApiError, apiRequest } from "@/lib/api";
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
  id: string;
  rateDate: string;
  goldPricePerGramUsd: string;
  usdToSrdRate: string;
  eurToUsdRate: string;
};

export function SalesPage() {
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
  const [form, setForm] = useState({
    clientId: "",
    createdById: "",
    physicalWeight: "",
    purityPercentage: "",
    spotPriceOz: "",
    negotiatedPricePerGramUsd: ""
  });
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([createAutofilledPaymentLine(1, null, ZERO, [])]);
  const [totalOrderValueUsdInput, setTotalOrderValueUsdInput] = useState("0.0000");
  const [hasManualTotalOverride, setHasManualTotalOverride] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const latestRate = await apiRequest<DailyRate>("/rates/latest", "GET");
        setRate(latestRate);
        setPaymentLines([createAutofilledPaymentLine(1, latestRate, ZERO, [])]);
      } catch {
        setGlobalError("Nao foi possivel carregar taxa diaria.");
      } finally {
        setLoading(false);
      }
    };

    load().catch(() => setLoading(false));
  }, []);

  const physicalWeight = useMemo(() => parseDecimal(form.physicalWeight), [form.physicalWeight]);
  const negotiatedPricePerGramUsd = useMemo(() => parseDecimal(form.negotiatedPricePerGramUsd), [form.negotiatedPricePerGramUsd]);
  const calculatedOrderValueUsd = useMemo(() => physicalWeight.mul(negotiatedPricePerGramUsd).toDecimalPlaces(4, Decimal.ROUND_HALF_UP), [physicalWeight, negotiatedPricePerGramUsd]);
  const totalOrderValueUsd = useMemo(() => parseDecimal(totalOrderValueUsdInput).toDecimalPlaces(4, Decimal.ROUND_HALF_UP), [totalOrderValueUsdInput]);
  const paymentPreview = useMemo(() => calculatePaymentPreview(paymentLines, totalOrderValueUsd), [paymentLines, totalOrderValueUsd]);
  const totalSplitAmountUsd = useMemo(() => calculateTotalAmountUsd(paymentLines), [paymentLines]);
  const splitDeltaUsd = useMemo(() => totalOrderValueUsd.sub(totalSplitAmountUsd).toDecimalPlaces(4, Decimal.ROUND_HALF_UP), [totalOrderValueUsd, totalSplitAmountUsd]);
  const amountAlert = useMemo(() => buildAmountAlert(totalSplitAmountUsd, totalOrderValueUsd), [totalSplitAmountUsd, totalOrderValueUsd]);

  useEffect(() => {
    if (!hasManualTotalOverride) {
      setTotalOrderValueUsdInput(decimalText(calculatedOrderValueUsd));
    }
  }, [calculatedOrderValueUsd, hasManualTotalOverride]);

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
    form.createdById.trim() !== "" &&
    form.physicalWeight.trim() !== "" &&
    form.purityPercentage.trim() !== "" &&
    form.negotiatedPricePerGramUsd.trim() !== "" &&
    totalOrderValueUsd.gt(0) &&
    !complianceBlocked &&
    !!rate;

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
      createdById: "",
      physicalWeight: "",
      purityPercentage: "",
      spotPriceOz: "",
      negotiatedPricePerGramUsd: ""
    });
    setSelectedClient(null);
    setIsWalkIn(false);
    setPaymentLines([createAutofilledPaymentLine(1, rate, ZERO, [])]);
    setTotalOrderValueUsdInput("0.0000");
    setHasManualTotalOverride(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setGlobalError("");
    setFieldErrors({});

    if (complianceBlocked) {
      setGlobalError("KYC obrigatorio para avulso acima de USD 10.000,00 com a politica atual.");
      return;
    }

    if (!canFinalize || !rate) {
      setGlobalError("A venda so pode ser finalizada quando a soma exata dos splits em USD fechar o total da ordem.");
      return;
    }

    const normalizedPayload = {
      clientId: isWalkIn ? undefined : form.clientId,
      isWalkIn,
      createdById: form.createdById,
      dailyRateId: rate.id,
      goldState,
      physicalWeight: format4(form.physicalWeight),
      purityPercentage: format4(form.purityPercentage),
      negotiatedPricePerGram: format4(form.negotiatedPricePerGramUsd),
      totalOrderValueUsd: format4(totalOrderValueUsdInput),
      paymentSplits: paymentLines.map((line) => {
        const preview = paymentPreview.find((item) => item.id === line.id);
        return {
          currency: line.currency,
          amount: preview ? decimalText(preview.settlementAmount) : "0.0000"
        };
      })
    };

    const treasuryAuditPayload = {
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

    console.log("SalesOrderService payload", treasuryAuditPayload);

    try {
      setSubmitting(true);
      await apiRequest("/orders/sale", "POST", normalizedPayload);
      setMessage("Venda finalizada com sucesso.");
      resetForm();
    } catch (error) {
      if (error instanceof ApiError) {
        setGlobalError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setGlobalError("Falha ao finalizar venda.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (field: string) => fieldErrors[field];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <Card title="Mesa de Venda">
          <form onSubmit={submit} className="space-y-5">
            {globalError ? <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{globalError}</div> : null}
            {message ? <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
            <div className="rounded-2xl border border-stone-300/70 bg-stone-50 p-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Contraparte da Venda</p>
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
                      Avulso
                    </label>
                  </div>
                  <TradePartySelector
                    type="CLIENT"
                    label="Cliente"
                    value={form.clientId}
                    disabled={isWalkIn}
                    placeholder={isWalkIn ? "Atendimento avulso" : "Buscar cliente"}
                    emptyText="Nenhum cliente encontrado."
                    errorMessage={fieldError("clientId")}
                    onOptionsLoaded={setClientCount}
                    onChange={(option) => {
                      setSelectedClient(option);
                      setForm((current) => ({ ...current, clientId: option?.id ?? "" }));
                    }}
                  />
                </div>
                <label className="xl:col-span-2">
                  ID do Operador de Caixa
                  <input value={form.createdById} onChange={(event) => setForm({ ...form, createdById: event.target.value })} required />
                  {fieldError("createdById") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("createdById")}</p> : null}
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-300/70 bg-stone-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">Estado Fisico do Ouro</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800">
                  <input type="radio" name="goldStateSales" checked={goldState === "BURNED"} onChange={() => setGoldState("BURNED")} />
                  Ouro Queimado
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800">
                  <input type="radio" name="goldStateSales" checked={goldState === "MELTED"} onChange={() => setGoldState("MELTED")} />
                  Ouro Fundido
                </label>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label>
                {goldState === "BURNED" ? "Peso do Ouro Queimado (g)" : "Peso do Ouro Fundido (g)"}
                <input value={form.physicalWeight} onChange={(event) => setForm({ ...form, physicalWeight: event.target.value })} required />
                {fieldError("physicalWeight") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("physicalWeight")}</p> : null}
              </label>
              <label>
                Teor de Pureza (%)
                <input value={form.purityPercentage} onChange={(event) => setForm({ ...form, purityPercentage: event.target.value })} required />
                {fieldError("purityPercentage") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("purityPercentage")}</p> : null}
              </label>
              <label>
                Preço Spot da Onça (Referência Bolsa)
                <input value={form.spotPriceOz} onChange={(event) => setForm({ ...form, spotPriceOz: event.target.value })} placeholder="Ex: 2300.0000" />
              </label>
              <label>
                Preço Negociado por Grama (USD)
                <input value={form.negotiatedPricePerGramUsd} onChange={(event) => setForm({ ...form, negotiatedPricePerGramUsd: event.target.value })} required />
                {fieldError("negotiatedPricePerGram") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("negotiatedPricePerGram")}</p> : null}
              </label>
              <div className="xl:col-span-3">
                <PriceSuggestionBreakdown spotPriceOz={form.spotPriceOz} purityPercentage={form.purityPercentage} />
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label>
                Valor Total da Ordem (USD)
                <input
                  value={totalOrderValueUsdInput}
                  onChange={(event) => {
                    setHasManualTotalOverride(true);
                    setTotalOrderValueUsdInput(event.target.value);
                  }}
                  required
                />
                <p className="mt-1 text-xs text-stone-600">
                  Preenchido automaticamente por Peso do Ouro Queimado x Preco Negociado, com ajuste manual opcional de centavos.
                </p>
                {fieldError("totalOrderValueUsd") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("totalOrderValueUsd")}</p> : null}
              </label>
              <button
                type="button"
                className="rounded-2xl border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                onClick={() => {
                  setHasManualTotalOverride(false);
                  setTotalOrderValueUsdInput(decimalText(calculatedOrderValueUsd));
                }}
              >
                Usar calculo automatico
              </button>
            </div>
            {needsSoftComplianceWarning ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Compliance: atendimento avulso acima de USD 10.000,00.</p>
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

            <TreasurySplitPlanner
              paymentLines={paymentLines}
              paymentPreview={paymentPreview}
              amountAlert={amountAlert}
              rate={rate}
              settlementLabel="Valor Calculado no Caixa"
              helperText="Padrão de tesouraria igual ao da compra, agora para recebimento multimoeda da venda."
              onAdd={addLine}
              onRemove={removeLine}
              onSetLine={setLine}
            />
            {fieldError("paymentSplits") ? <p className="-mt-2 text-xs font-semibold text-red-700">{fieldError("paymentSplits")}</p> : null}

            <button disabled={!canFinalize || submitting} className={`rounded-2xl px-5 py-3 text-sm font-semibold ${canFinalize && !submitting ? "bg-emerald-700 text-white hover:bg-emerald-600" : "cursor-not-allowed bg-stone-300 text-stone-600"}`}>
              {submitting ? "Processando Transacao..." : "Finalizar Venda"}
            </button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card title="Snapshot de Mercado">
            <div className="grid gap-3">
              <LabeledValue label="Preço do Ouro por Grama (USD)" value={`USD ${rate ? format4(rate.goldPricePerGramUsd) : "0.0000"}`} />
              <LabeledValue label="Taxa USD para SRD" value={rate ? format4(rate.usdToSrdRate) : "0.0000"} />
              <LabeledValue label="Taxa EUR para USD" value={rate ? format4(rate.eurToUsdRate) : "0.0000"} />
              <LabeledValue label="Data da Cotação" value={rate?.rateDate?.slice(0, 10) ?? "-"} />
            </div>
          </Card>

          <Card title="Resumo Operacional">
            <div className="space-y-3 text-sm text-stone-700">
              <p><strong>Clientes carregados:</strong> {loading ? "carregando" : clientCount}</p>
              <p><strong>Modo da ordem:</strong> {isWalkIn ? "Atendimento avulso" : "Cliente cadastrado"}</p>
              <p><strong>Cliente selecionado:</strong> {selectedClient?.displayName ?? "-"}</p>
              <p><strong>Origem declarada:</strong> {selectedClient?.goldOrigin ?? "-"}</p>
              <p><strong>Linhas de recebimento:</strong> {paymentLines.length}</p>
              <p><strong>Status do rateio:</strong> {splitDeltaUsd.eq(ZERO) ? "Fechado no valor exato" : "Aguardando ajuste de centavos"}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}