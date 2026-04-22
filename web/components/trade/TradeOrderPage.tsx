"use client";

import Decimal from "decimal.js";
import { useEffect, useMemo, useState } from "react";

import { TradePartyOption, TradePartySelector } from "@/components/TradePartySelector";
import { TreasurySplitPlanner } from "@/components/TreasurySplitPlanner";
import { HelpHint } from "@/components/trade/HelpHint";
import { useDailyRate } from "@/components/trade/useDailyRate";
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

type TradeOrderMode = "purchase" | "sale";

type TradeOrderPayload = {
  clientId?: string;
  supplierId?: string;
  isWalkIn: boolean;
  goldState: "BURNED" | "MELTED";
  physicalWeight: string;
  purityPercentage: string;
  negotiatedPricePerGram: string;
  paymentSplits: Array<{
    currency: string;
    amount: string;
    manualExchangeRate?: string;
  }>;
};

type TradeOrderAuditPayload = {
  clientId?: string;
  supplierId?: string;
  isWalkIn: boolean;
  goldState: "BURNED" | "MELTED";
  physicalWeight: string;
  purityPercentage: string;
  negotiatedPricePerGram: string;
  totalOrderValueUsd: string;
  effectiveFineGoldWeight: string;
  paymentSplits: Array<{
    currency: string;
    splitPercentage: string;
    splitAmountUsd: string;
    manualExchangeRate: string | null;
    settlementAmount: string;
  }>;
};

type TradeOrderConfig = {
  pageTitle: string;
  submitPath: "/orders/purchase" | "/orders/sale";
  successMessage: string;
  failureMessage: string;
  finalizeLabel: string;
  processingLabel: string;
  servicePayloadLabel: string;
  counterpartyType: "CLIENT" | "SUPPLIER";
  counterpartyLabel: "Cliente" | "Fornecedor";
  counterpartyHeader: string;
  walkInLabel: string;
  walkInPlaceholder: string;
  searchPlaceholder: string;
  emptyText: string;
  counterpartyField: "clientId" | "supplierId";
  summaryCountLabel: string;
  summarySelectedLabel: string;
  summaryMetadataLabel: string;
  summaryMetadataAccessor: (option: TradePartyOption | null) => string;
  summaryLineLabel: string;
  splitHelperText: string;
  receiptTitle: string;
  receiptSplitLabel: string;
  complianceWarning: string;
  complianceModalText: string;
};

const CONFIG_BY_MODE: Record<TradeOrderMode, TradeOrderConfig> = {
  purchase: {
    pageTitle: "Mesa de Compra",
    submitPath: "/orders/purchase",
    successMessage: "Compra finalizada com sucesso.",
    failureMessage: "Falha ao finalizar compra.",
    finalizeLabel: "Finalizar Compra",
    processingLabel: "Processando Transacao...",
    servicePayloadLabel: "PurchaseOrderService payload",
    counterpartyType: "CLIENT",
    counterpartyLabel: "Cliente",
    counterpartyHeader: "Contraparte da Compra",
    walkInLabel: "Cliente Avulso",
    walkInPlaceholder: "Cliente Avulso",
    searchPlaceholder: "Buscar cliente",
    emptyText: "Nenhum cliente encontrado.",
    counterpartyField: "clientId",
    summaryCountLabel: "Clientes carregados",
    summarySelectedLabel: "Cliente selecionado",
    summaryMetadataLabel: "Origem declarada",
    summaryMetadataAccessor: (option) => option?.goldOrigin ?? "-",
    summaryLineLabel: "Linhas de payout",
    splitHelperText: "Cada linha já inicia com a cotação diária sugerida, mas permanece totalmente editável pelo operador.",
    receiptTitle: "Recibo de Conferência da Compra",
    receiptSplitLabel: "Rateio de pagamento",
    complianceWarning: "Compliance: cliente avulso acima de USD 10.000,00.",
    complianceModalText: "Esta compra está acima de USD 10.000,00 em modo avulso. Deseja continuar para conferência final ou cancelar agora?"
  },
  sale: {
    pageTitle: "Mesa de Venda",
    submitPath: "/orders/sale",
    successMessage: "Venda finalizada com sucesso.",
    failureMessage: "Falha ao finalizar venda.",
    finalizeLabel: "Finalizar Venda",
    processingLabel: "Processando Transacao...",
    servicePayloadLabel: "SalesOrderService payload",
    counterpartyType: "SUPPLIER",
    counterpartyLabel: "Fornecedor",
    counterpartyHeader: "Contraparte da Venda",
    walkInLabel: "Fornecedor Avulso",
    walkInPlaceholder: "Fornecedor Avulso",
    searchPlaceholder: "Buscar fornecedor",
    emptyText: "Nenhum fornecedor encontrado.",
    counterpartyField: "supplierId",
    summaryCountLabel: "Fornecedores carregados",
    summarySelectedLabel: "Fornecedor selecionado",
    summaryMetadataLabel: "Contato principal",
    summaryMetadataAccessor: (option) => option?.contactName ?? "-",
    summaryLineLabel: "Linhas de recebimento",
    splitHelperText: "Padrão de tesouraria igual ao da compra, agora para recebimento multimoeda da venda.",
    receiptTitle: "Recibo de Conferência da Venda",
    receiptSplitLabel: "Rateio de recebimento",
    complianceWarning: "Compliance: fornecedor avulso acima de USD 10.000,00.",
    complianceModalText: "Esta venda está acima de USD 10.000,00 em modo avulso. Deseja continuar para conferência final ou cancelar agora?"
  }
};

type TradeOrderPageProps = {
  mode: TradeOrderMode;
};

export function TradeOrderPage({ mode }: TradeOrderPageProps) {
  const auth = useAuthStore();
  const { loading, rate } = useDailyRate();
  const config = CONFIG_BY_MODE[mode];

  const [goldState, setGoldState] = useState<"BURNED" | "MELTED">("BURNED");
  const [selectedCounterparty, setSelectedCounterparty] = useState<TradePartyOption | null>(null);
  const [counterpartyCount, setCounterpartyCount] = useState(0);
  const [message, setMessage] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<null | "compliance" | "receipt">(null);
  const [pendingPayload, setPendingPayload] = useState<TradeOrderPayload | null>(null);
  const [pendingAuditPayload, setPendingAuditPayload] = useState<TradeOrderAuditPayload | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    supplierId: "",
    physicalWeight: "",
    purityPercentage: "",
    negotiatedPricePerGramUsd: ""
  });
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([createAutofilledPaymentLine(1, null, ZERO, [])]);

  useEffect(() => {
    setPaymentLines([createAutofilledPaymentLine(1, rate, ZERO, [])]);
  }, [rate]);

  const negotiatedPricePerGramUsd = useMemo(() => parseDecimal(form.negotiatedPricePerGramUsd), [form.negotiatedPricePerGramUsd]);
  const effectiveFineGoldWeight = useMemo(() => {
    const physicalWeight = parseDecimal(form.physicalWeight);
    const purityFraction = parseDecimal(form.purityPercentage).div(100);
    return physicalWeight.mul(purityFraction).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }, [form.physicalWeight, form.purityPercentage]);
  const calculatedOrderValueUsd = useMemo(
    () => effectiveFineGoldWeight.mul(negotiatedPricePerGramUsd).toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
    [effectiveFineGoldWeight, negotiatedPricePerGramUsd]
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
  const counterpartId = form[config.counterpartyField].trim();
  const canFinalize =
    splitDeltaUsd.eq(ZERO) &&
    !hasSplitErrors &&
    (isWalkIn || counterpartId !== "") &&
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
      setGlobalError(`A ${mode === "purchase" ? "compra" : "venda"} so pode ser finalizada quando a soma exata dos splits em USD fechar o total calculado pelo peso fino efetivo e todos os campos obrigatorios estiverem preenchidos.`);
      return false;
    }

    return true;
  };

  const buildPayloads = (): { normalizedPayload: TradeOrderPayload; treasuryAuditPayload: TradeOrderAuditPayload } => {
    const counterpartData = config.counterpartyField === "clientId"
      ? { clientId: isWalkIn ? undefined : form.clientId }
      : { supplierId: isWalkIn ? undefined : form.supplierId };

    const normalizedPayload: TradeOrderPayload = {
      ...counterpartData,
      isWalkIn,
      goldState,
      physicalWeight: format4(form.physicalWeight),
      purityPercentage: format4(form.purityPercentage),
      negotiatedPricePerGram: format4(form.negotiatedPricePerGramUsd),
      paymentSplits: paymentLines.map((line) => {
        const preview = paymentPreview.find((item) => item.id === line.id);
        return {
          currency: line.currency,
          amount: preview ? decimalText(preview.settlementAmount) : "0.0000",
          manualExchangeRate: line.currency === "USD" ? undefined : format4(line.manualExchangeRate || "0")
        };
      })
    };

    const treasuryAuditPayload: TradeOrderAuditPayload = {
      ...normalizedPayload,
      totalOrderValueUsd: decimalText(totalOrderValueUsd),
      effectiveFineGoldWeight: decimalText(effectiveFineGoldWeight),
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
      await apiRequest(config.submitPath, "POST", pendingPayload);
      setMessage(config.successMessage);
      resetForm();
    } catch (error) {
      if (error instanceof ApiError) {
        setGlobalError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setGlobalError(config.failureMessage);
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
      supplierId: "",
      physicalWeight: "",
      purityPercentage: "",
      negotiatedPricePerGramUsd: ""
    });
    setSelectedCounterparty(null);
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

    console.log(config.servicePayloadLabel, treasuryAuditPayload);

    setActiveModal(needsSoftComplianceWarning ? "compliance" : "receipt");
  };

  const fieldError = (field: string) => fieldErrors[field];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
        <Card title={config.pageTitle}>
          <form onSubmit={submit} className="space-y-5">
            {globalError ? <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{globalError}</div> : null}
            {message ? <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
            <div className="rounded-2xl border border-stone-300/70 bg-stone-50 p-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">{config.counterpartyHeader}</p>
                      <HelpHint
                        title={config.counterpartyHeader}
                        content="Selecione a contraparte da operação. Se nao for cadastrado, ative o modo avulso."
                      />
                    </div>
                    <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800">
                      <input
                        type="checkbox"
                        checked={isWalkIn}
                        onChange={(event) => {
                          setIsWalkIn(event.target.checked);
                          if (event.target.checked) {
                            setForm((current) => ({ ...current, [config.counterpartyField]: "" }));
                            setSelectedCounterparty(null);
                          }
                        }}
                      />
                      {config.walkInLabel}
                      <HelpHint
                        title={config.walkInLabel}
                        content="Use quando nao houver cadastro. Dependendo do valor, a politica de compliance pode exigir bloqueio."
                      />
                    </label>
                  </div>
                  <TradePartySelector
                    type={config.counterpartyType}
                    label={config.counterpartyLabel}
                    value={form[config.counterpartyField]}
                    disabled={isWalkIn}
                    placeholder={isWalkIn ? config.walkInPlaceholder : config.searchPlaceholder}
                    emptyText={config.emptyText}
                    errorMessage={fieldError(config.counterpartyField)}
                    onOptionsLoaded={setCounterpartyCount}
                    onChange={(option) => {
                      setSelectedCounterparty(option);
                      setForm((current) => ({ ...current, [config.counterpartyField]: option?.id ?? "" }));
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
                  content="Classifica o tipo de ouro para controle de estoque e rastreabilidade financeira da operacao."
                />
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800">
                  <input type="radio" name={`goldState-${mode}`} checked={goldState === "BURNED"} onChange={() => setGoldState("BURNED")} />
                  Ouro Queimado
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800">
                  <input type="radio" name={`goldState-${mode}`} checked={goldState === "MELTED"} onChange={() => setGoldState("MELTED")} />
                  Ouro Fundido
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-300/80 bg-white/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-stone-700">Dados tecnicos da ordem</p>
                <HelpHint
                  title="Dados tecnicos da ordem"
                  content="Campos principais para precificacao e registro tecnico da operacao."
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="rounded-xl border border-stone-200 bg-white p-3 text-xs font-semibold text-stone-700">
                  <span className="mb-2 flex min-h-[2.5rem] items-start justify-between gap-2 text-xs md:text-sm">
                    <span className="leading-snug">{goldState === "BURNED" ? "Peso do Ouro Queimado (g)" : "Peso do Ouro Fundido (g)"}</span>
                    <HelpHint
                      title="Peso do Ouro"
                      content="Peso fisico medido da peca. O total usa o peso fino efetivo, calculado como peso fisico x pureza."
                    />
                  </span>
                  <input className="text-sm font-semibold md:text-base" value={form.physicalWeight} onChange={(event) => setForm({ ...form, physicalWeight: event.target.value })} required />
                  {fieldError("physicalWeight") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("physicalWeight")}</p> : null}
                </label>
                <label className="rounded-xl border border-stone-200 bg-white p-3 text-xs font-semibold text-stone-700">
                  <span className="mb-2 flex min-h-[2.5rem] items-start justify-between gap-2 text-xs md:text-sm">
                    <span className="leading-snug">Teor de Pureza (%)</span>
                    <HelpHint
                      title="Teor de Pureza"
                      content="Percentual aplicado sobre o peso fisico para chegar ao peso fino efetivo usado no total da ordem."
                    />
                  </span>
                  <input className="text-sm font-semibold md:text-base" value={form.purityPercentage} onChange={(event) => setForm({ ...form, purityPercentage: event.target.value })} required />
                  {fieldError("purityPercentage") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("purityPercentage")}</p> : null}
                </label>
                <label className="rounded-xl border border-stone-200 bg-white p-3 text-xs font-semibold text-stone-700">
                  <span className="mb-2 flex min-h-[2.5rem] items-start justify-between gap-2 text-xs md:text-sm">
                    <span className="leading-snug">Preco da Grama da Ordem (USD)</span>
                    <HelpHint
                      title="Preco da Grama"
                      content="Preco final negociado na operacao. Pode seguir o spot e ser ajustado conforme a negociacao."
                    />
                  </span>
                  <input
                    className="text-sm font-semibold md:text-base"
                    value={form.negotiatedPricePerGramUsd}
                    onChange={(event) => setForm({ ...form, negotiatedPricePerGramUsd: event.target.value })}
                    required
                  />
                  <p className="mt-2 text-xs text-stone-600">Use o preço da bolsa no painel da direita como referência e ajuste para esta ordem.</p>
                  {fieldError("negotiatedPricePerGram") ? <p className="mt-1 text-xs font-semibold text-red-700">{fieldError("negotiatedPricePerGram")}</p> : null}
                </label>
              </div>
            </div>
            {needsSoftComplianceWarning ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">{config.complianceWarning}</p>
                <p className="mt-1 text-xs">
                  {REQUIRE_KYC_ABOVE_10K
                    ? "Politica atual exige KYC e bloqueia finalizacao sem cadastro."
                    : "Politica atual permite finalizar com override de compliance registrado automaticamente."}
                </p>
              </div>
            ) : null}

            <div className="rounded-2xl border border-stone-300/70 bg-stone-950 p-4 text-stone-100">
              <div className="grid gap-3 md:grid-cols-2">
                <LabeledValue label="Peso Fino Efetivo" value={`${decimalText(effectiveFineGoldWeight)} g`} />
                <LabeledValue label="Preço Negociado por Grama" value={`USD ${decimalText(negotiatedPricePerGramUsd)}`} />
                <LabeledValue label="Valor Total da Ordem (USD)" value={`USD ${decimalText(totalOrderValueUsd)}`} />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-600">
              <span>Rateio de Tesouraria</span>
              <HelpHint
                title="Rateio de Tesouraria"
                content="Distribua o valor em moedas e taxas. A ordem so finaliza quando o total em USD fecha exatamente."
              />
            </div>

            <TreasurySplitPlanner
              paymentLines={paymentLines}
              paymentPreview={paymentPreview}
              amountAlert={amountAlert}
              rate={rate}
              settlementLabel="Valor Calculado no Caixa"
              helperText={config.splitHelperText}
              onAdd={addLine}
              onRemove={removeLine}
              onSetLine={setLine}
            />
            {fieldError("paymentSplits") ? <p className="-mt-2 text-xs font-semibold text-red-700">{fieldError("paymentSplits")}</p> : null}

            <button disabled={submitting} className={`rounded-2xl px-5 py-3 text-sm font-semibold ${!submitting ? "bg-emerald-700 text-white hover:bg-emerald-600" : "cursor-not-allowed bg-stone-300 text-stone-600"}`}>
              {submitting ? config.processingLabel : config.finalizeLabel}
            </button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card title="Snapshot de Mercado">
            <div className="mb-3 flex items-center gap-2 text-xs text-stone-600">
              <span>Referencias de preco e cambio para apoiar a negociacao.</span>
              <HelpHint
                title="Snapshot de Mercado"
                content="Mostra cotacoes usadas como referencia operacional para precificar a ordem."
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
                content="Checklist da operacao com contraparte, modo da ordem e status do rateio antes da confirmacao."
              />
            </div>
            <div className="space-y-3 text-sm text-stone-700">
              <p><strong>{config.summaryCountLabel}:</strong> {loading ? "carregando" : counterpartyCount}</p>
              <p><strong>Modo da ordem:</strong> {isWalkIn ? config.walkInLabel : `${config.counterpartyLabel} cadastrado`}</p>
              <p><strong>{config.summarySelectedLabel}:</strong> {selectedCounterparty?.displayName ?? "-"}</p>
              <p><strong>{config.summaryMetadataLabel}:</strong> {config.summaryMetadataAccessor(selectedCounterparty)}</p>
              <p><strong>{config.summaryLineLabel}:</strong> {paymentLines.length}</p>
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
                  {config.complianceModalText}
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
                <h3 className="font-heading text-lg font-semibold text-stone-900">{config.receiptTitle}</h3>
                <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
                  <p><strong>Operador:</strong> {auth.userName ?? "-"}</p>
                  <p><strong>Contraparte:</strong> {isWalkIn ? config.walkInLabel : selectedCounterparty?.displayName ?? "-"}</p>
                  <p><strong>Estado do ouro:</strong> {pendingAuditPayload?.goldState ?? "-"}</p>
                  <p><strong>Peso físico:</strong> {pendingAuditPayload?.physicalWeight ?? "-"} g</p>
                  <p><strong>Pureza:</strong> {pendingAuditPayload?.purityPercentage ?? "-"} %</p>
                  <p><strong>Peso fino efetivo:</strong> {pendingAuditPayload?.effectiveFineGoldWeight ?? "-"} g</p>
                  <p><strong>Preço por grama:</strong> USD {pendingAuditPayload?.negotiatedPricePerGram ?? "-"}</p>
                  <p><strong>Total da ordem:</strong> USD {pendingAuditPayload?.totalOrderValueUsd ?? "-"}</p>
                  <div>
                    <p className="mb-2 font-semibold text-stone-800">{config.receiptSplitLabel}</p>
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