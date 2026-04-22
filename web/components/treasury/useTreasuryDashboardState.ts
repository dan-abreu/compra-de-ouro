import Decimal from "decimal.js";
import { useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { D } from "@/lib/decimal";

export type Currency = "USD" | "EUR" | "SRD";
export type LoanInputCurrency = Currency | "GOLD";
export type LoanDirection = "RECEIVED" | "GRANTED";
export type CounterpartyType = "CLIENT" | "SUPPLIER" | "EMPLOYEE" | "THIRD_PARTY";
export type ExpectedRepayment = "CASH" | "GOLD" | "MIXED";
export type MonthlyCostType = "NONE" | "PERCENTAGE" | "FIXED";
export type CostBaseType = "CURRENT_BALANCE" | "ORIGINAL_PRINCIPAL";
export type CashEffectDirection = "IN" | "OUT";

export type TreasuryResponse = {
  generatedAt: string;
  vault: {
    balanceUsd: string;
    balanceEur: string;
    balanceSrd: string;
    balanceGoldGrams: string;
    openGoldGrams: string;
    openGoldAcquisitionCostUsd: string;
  } | null;
  goldByCategory: Array<{
    category: "BURNED" | "MELTED";
    label: string;
    netWeightGrams: string;
    purchasedWeightGrams: string;
    costBasisUsd: string;
    avgCostPerGramUsd: string;
  }>;
  pnlToday: {
    tradingProfitUsd: string;
    grossRevenueUsd: string;
    totalPurchaseCostUsd: string;
    saleCount: number;
    purchaseCount: number;
  };
  pnlLifetime: {
    tradingProfitUsd: string;
    grossRevenueUsd: string;
    totalPurchaseCostUsd: string;
    saleCount: number;
    purchaseCount: number;
  };
  currencyFlows: {
    USD: { currency: "USD"; paidOutInPurchases: string; receivedFromSales: string; netFlow: string };
    EUR: { currency: "EUR"; paidOutInPurchases: string; receivedFromSales: string; netFlow: string };
    SRD: { currency: "SRD"; paidOutInPurchases: string; receivedFromSales: string; netFlow: string };
  };
  loanBooks: Array<{
    id: string;
    direction: LoanDirection;
    counterpartyType: CounterpartyType;
    counterpartyName: string;
    counterpartyDocument: string | null;
    principalAmountUsd: string;
    principalInputCurrency: string;
    principalInputAmount: string;
    runningBalanceUsd: string;
    frontMoneyUsd: string;
    goldOwedGrams: string;
    settlementExpectation: ExpectedRepayment;
    monthlyCostType: MonthlyCostType;
    monthlyRatePercent: string;
    monthlyFixedCostUsd: string;
    costBaseType: CostBaseType | null;
    monthlyCostUsd: string;
    startDate: string;
    dueDate: string | null;
    billingDay: number | null;
    status: "OPEN" | "SETTLED" | "CANCELED";
    updatedAt: string;
  }>;
  opexToday: Array<{
    id: string;
    category: string;
    description: string;
    amountUsd: string;
    occurredAt: string;
  }>;
};

type DailyRate = {
  goldPricePerGramUsd: string;
  usdToSrdRate: string;
  eurToUsdRate: string;
};

export type LocalLoanRow = TreasuryResponse["loanBooks"][number] & {
  inputCurrency: LoanInputCurrency;
  inputAmount: string;
  cashEffectDirection: CashEffectDirection;
};

export type LocalOpexRow = TreasuryResponse["opexToday"][number] & {
  inputCurrency: Currency;
  inputAmount: string;
};

export type ExpenseFormState = {
  description: string;
  amount: string;
  currency: Currency;
  occurredAt: string;
};

export type LoanFormState = {
  direction: LoanDirection;
  counterpartyType: CounterpartyType;
  counterpartyName: string;
  counterpartyDocument: string;
  amount: string;
  currency: LoanInputCurrency;
  expectedRepayment: ExpectedRepayment;
  monthlyCostType: MonthlyCostType;
  monthlyRatePercent: string;
  monthlyFixedCost: string;
  costBaseType: CostBaseType;
  startDate: string;
  dueDate: string;
  billingDay: string;
  notes: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const initialExpenseForm = (): ExpenseFormState => ({
  description: "",
  amount: "",
  currency: "USD",
  occurredAt: todayIso()
});

const initialLoanForm = (): LoanFormState => ({
  direction: "GRANTED",
  counterpartyType: "THIRD_PARTY",
  counterpartyName: "",
  counterpartyDocument: "",
  amount: "",
  currency: "USD",
  expectedRepayment: "CASH",
  monthlyCostType: "NONE",
  monthlyRatePercent: "",
  monthlyFixedCost: "",
  costBaseType: "CURRENT_BALANCE",
  startDate: todayIso(),
  dueDate: "",
  billingDay: "",
  notes: ""
});

const inferCashEffectDirection = (direction: LoanDirection): CashEffectDirection =>
  direction === "RECEIVED" ? "IN" : "OUT";

const parseLoanInputCurrency = (value: string): LoanInputCurrency => {
  if (value === "USD" || value === "EUR" || value === "SRD" || value === "GOLD") {
    return value;
  }
  return "USD";
};

const toLocalLoanRow = (row: TreasuryResponse["loanBooks"][number]): LocalLoanRow => {
  const inputCurrency = parseLoanInputCurrency(row.principalInputCurrency);
  return {
    ...row,
    inputCurrency,
    inputAmount: row.principalInputAmount,
    cashEffectDirection: inferCashEffectDirection(row.direction)
  };
};

export function useTreasuryDashboardState() {
  const [treasury, setTreasury] = useState<TreasuryResponse | null>(null);
  const [marketRate, setMarketRate] = useState<DailyRate | null>(null);
  const [loanRows, setLoanRows] = useState<LocalLoanRow[]>([]);
  const [opexRows, setOpexRows] = useState<LocalOpexRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(initialExpenseForm);
  const [loanForm, setLoanForm] = useState<LoanFormState>(initialLoanForm);

  useEffect(() => {
    const load = async () => {
      try {
        const [treasuryData, rateData] = await Promise.all([
          apiRequest<TreasuryResponse>("/treasury", "GET"),
          apiRequest<DailyRate>("/rates/market-live", "GET").catch(() => null)
        ]);
        setTreasury(treasuryData);
        setMarketRate(rateData);
        setLoanRows(treasuryData.loanBooks.map(toLocalLoanRow));
        setOpexRows(
          treasuryData.opexToday.map((row) => ({
            ...row,
            inputCurrency: "USD",
            inputAmount: row.amountUsd
          }))
        );
      } catch (error) {
        if (error instanceof ApiError) {
          setMessage(error.message);
        } else {
          setMessage("Nao foi possivel carregar o painel da tesouraria.");
        }
      } finally {
        setLoading(false);
      }
    };

    load().catch(() => {
      setMessage("Nao foi possivel carregar o painel da tesouraria.");
      setLoading(false);
    });
  }, []);

  const usdToSrd = useMemo(() => D(marketRate?.usdToSrdRate ?? "38.2000"), [marketRate]);
  const eurToUsd = useMemo(() => D(marketRate?.eurToUsdRate ?? "1.0831"), [marketRate]);
  const spotGramUsd = useMemo(() => D(marketRate?.goldPricePerGramUsd ?? "76.6500"), [marketRate]);

  const vaultBalanceUsd = D(treasury?.vault?.balanceUsd ?? "0");
  const vaultBalanceEur = D(treasury?.vault?.balanceEur ?? "0");
  const vaultBalanceSrd = D(treasury?.vault?.balanceSrd ?? "0");

  const getLoanMovementTotal = (currency: Currency, direction: CashEffectDirection) =>
    loanRows
      .filter((row) => row.inputCurrency === currency && row.cashEffectDirection === direction)
      .reduce((acc, row) => acc.plus(D(row.inputAmount || 0)), D(0));

  const getExpenseMovementTotal = (currency: Currency) =>
    opexRows
      .filter((row) => row.inputCurrency === currency)
      .reduce((acc, row) => acc.plus(D(row.inputAmount || 0)), D(0));

  const adjustedVaultBalanceUsd = useMemo(
    () => vaultBalanceUsd.plus(getLoanMovementTotal("USD", "IN")).minus(getLoanMovementTotal("USD", "OUT")).minus(getExpenseMovementTotal("USD")),
    [vaultBalanceUsd, loanRows, opexRows]
  );
  const adjustedVaultBalanceEur = useMemo(
    () => vaultBalanceEur.plus(getLoanMovementTotal("EUR", "IN")).minus(getLoanMovementTotal("EUR", "OUT")).minus(getExpenseMovementTotal("EUR")),
    [vaultBalanceEur, loanRows, opexRows]
  );
  const adjustedVaultBalanceSrd = useMemo(
    () => vaultBalanceSrd.plus(getLoanMovementTotal("SRD", "IN")).minus(getLoanMovementTotal("SRD", "OUT")).minus(getExpenseMovementTotal("SRD")),
    [vaultBalanceSrd, loanRows, opexRows]
  );

  const totalCashUsdEq = useMemo(
    () => adjustedVaultBalanceUsd.plus(adjustedVaultBalanceEur.mul(eurToUsd)).plus(adjustedVaultBalanceSrd.div(usdToSrd)),
    [adjustedVaultBalanceUsd, adjustedVaultBalanceEur, adjustedVaultBalanceSrd, eurToUsd, usdToSrd]
  );

  const goldRows = treasury?.goldByCategory ?? [];
  const totalVaultGramsBase = useMemo(() => goldRows.reduce((acc, row) => acc.plus(D(row.netWeightGrams)), D(0)), [goldRows]);
  const goldLoanInflowGrams = useMemo(
    () =>
      loanRows
        .filter((row) => row.inputCurrency === "GOLD" && row.cashEffectDirection === "IN")
        .reduce((acc, row) => acc.plus(D(row.inputAmount || 0)), D(0)),
    [loanRows]
  );
  const goldLoanOutflowGrams = useMemo(
    () =>
      loanRows
        .filter((row) => row.inputCurrency === "GOLD" && row.cashEffectDirection === "OUT")
        .reduce((acc, row) => acc.plus(D(row.inputAmount || 0)), D(0)),
    [loanRows]
  );
  const totalVaultGrams = useMemo(
    () => totalVaultGramsBase.plus(goldLoanInflowGrams).minus(goldLoanOutflowGrams),
    [totalVaultGramsBase, goldLoanInflowGrams, goldLoanOutflowGrams]
  );
  const totalBookValueUsd = useMemo(() => goldRows.reduce((acc, row) => acc.plus(D(row.costBasisUsd)), D(0)), [goldRows]);
  const totalMtmValueUsd = useMemo(() => totalVaultGrams.mul(spotGramUsd), [totalVaultGrams, spotGramUsd]);
  const vaultUnrealizedPnl = useMemo(() => totalMtmValueUsd.minus(totalBookValueUsd), [totalMtmValueUsd, totalBookValueUsd]);

  const totalStorePayables = useMemo(
    () =>
      loanRows
        .filter((row) => row.direction === "RECEIVED")
        .reduce((acc, row) => acc.plus(D(row.runningBalanceUsd).abs()), D(0)),
    [loanRows]
  );
  const totalStoreReceivables = useMemo(
    () =>
      loanRows
        .filter((row) => row.direction === "GRANTED")
        .reduce((acc, row) => acc.plus(D(row.runningBalanceUsd).abs()), D(0)),
    [loanRows]
  );
  const totalMonthlyFinancialCost = useMemo(
    () =>
      loanRows
        .filter((row) => row.direction === "RECEIVED")
        .reduce((acc, row) => acc.plus(D(row.monthlyCostUsd ?? "0")), D(0)),
    [loanRows]
  );
  const totalMonthlyFinancialRevenue = useMemo(
    () =>
      loanRows
        .filter((row) => row.direction === "GRANTED")
        .reduce((acc, row) => acc.plus(D(row.monthlyCostUsd ?? "0")), D(0)),
    [loanRows]
  );
  const totalGoldOwed = useMemo(() => loanRows.reduce((acc, row) => acc.plus(D(row.goldOwedGrams)), D(0)), [loanRows]);

  const tradingProfit = D(treasury?.pnlToday.tradingProfitUsd ?? "0");
  const grossRevenue = D(treasury?.pnlToday.grossRevenueUsd ?? "0");
  const opexTotal = useMemo(
    () => opexRows.reduce((acc, line) => acc.plus(D(line.amountUsd)), D(0)).mul(-1),
    [opexRows]
  );
  const netPnl = useMemo(() => tradingProfit.plus(opexTotal), [tradingProfit, opexTotal]);
  const knownPeople = useMemo(
    () => Array.from(new Set(loanRows.map((row) => row.counterpartyName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [loanRows]
  );

  const convertToUsd = (amount: Decimal.Value, currency: LoanInputCurrency) => {
    const value = D(amount || 0);

    if (currency === "GOLD") {
      return value.mul(spotGramUsd);
    }

    if (currency === "EUR") {
      return value.mul(eurToUsd);
    }

    if (currency === "SRD") {
      return usdToSrd.eq(0) ? D(0) : value.div(usdToSrd);
    }

    return value;
  };

  const handleExpenseSave = () => {
    const rawAmount = D(expenseForm.amount || 0);

    if (!expenseForm.description.trim() || rawAmount.lte(0)) {
      return;
    }

    const convertedUsd = convertToUsd(rawAmount, expenseForm.currency);
    const nextRow: LocalOpexRow = {
      id: `local-opex-${Date.now()}`,
      category: "Despesa da Loja",
      description: expenseForm.description.trim(),
      amountUsd: convertedUsd.toFixed(4),
      occurredAt: expenseForm.occurredAt,
      inputCurrency: expenseForm.currency,
      inputAmount: rawAmount.toFixed(4)
    };

    setOpexRows((current) => [nextRow, ...current]);
    console.log("Despesa pronta para integrar com API:", nextRow);
    setExpenseForm(initialExpenseForm());
    setExpenseModalOpen(false);
  };

  const handleLoanSave = async () => {
    const rawAmount = D(loanForm.amount || 0);

    if (!loanForm.counterpartyName.trim() || rawAmount.lte(0)) {
      return;
    }

    if (loanForm.monthlyCostType === "PERCENTAGE" && D(loanForm.monthlyRatePercent || 0).lte(0)) {
      return;
    }

    if (loanForm.monthlyCostType === "FIXED" && D(loanForm.monthlyFixedCost || 0).lte(0)) {
      return;
    }

    const convertedUsd = convertToUsd(rawAmount, loanForm.currency);
    const estimatedGold = loanForm.expectedRepayment !== "CASH" && spotGramUsd.gt(0) ? convertedUsd.div(spotGramUsd) : D(0);
    const signedBalance = loanForm.direction === "RECEIVED" ? convertedUsd.mul(-1) : convertedUsd;
    const monthlyCostUsd = (() => {
      if (loanForm.monthlyCostType === "NONE") {
        return D(0);
      }

      if (loanForm.monthlyCostType === "FIXED") {
        return D(loanForm.monthlyFixedCost || 0);
      }

      const rate = D(loanForm.monthlyRatePercent || 0).div(100);
      const base = loanForm.costBaseType === "ORIGINAL_PRINCIPAL" ? convertedUsd : convertedUsd.abs();
      return base.mul(rate);
    })();

    const payload = {
      direction: loanForm.direction,
      counterpartyType: loanForm.counterpartyType,
      counterpartyName: loanForm.counterpartyName.trim(),
      counterpartyDocument: loanForm.counterpartyDocument.trim() || undefined,
      principalAmountUsd: convertedUsd.toFixed(4),
      principalInputCurrency: loanForm.currency,
      principalInputAmount: rawAmount.toFixed(4),
      settlementExpectation: loanForm.expectedRepayment,
      monthlyCostType: loanForm.monthlyCostType,
      monthlyRatePercent: loanForm.monthlyCostType === "PERCENTAGE" ? D(loanForm.monthlyRatePercent || 0).toFixed(4) : undefined,
      monthlyFixedCostUsd: loanForm.monthlyCostType === "FIXED" ? D(loanForm.monthlyFixedCost || 0).toFixed(4) : undefined,
      costBaseType: loanForm.monthlyCostType === "PERCENTAGE" ? loanForm.costBaseType : undefined,
      startDate: loanForm.startDate,
      dueDate: loanForm.dueDate || undefined,
      billingDay: loanForm.billingDay ? Number(loanForm.billingDay) : undefined,
      goldOwedGrams: estimatedGold.toFixed(4),
      notes: loanForm.notes.trim() || undefined
    };

    try {
      const created = await apiRequest<TreasuryResponse["loanBooks"][number]>("/loan-books", "POST", payload);
      setLoanRows((current) => [toLocalLoanRow(created), ...current]);
      setLoanForm(initialLoanForm());
      setLoanModalOpen(false);
      setMessage("Contrato financeiro salvo com sucesso.");
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
      } else {
        setMessage("Nao foi possivel salvar o contrato financeiro.");
      }
    }
  };

  const fxRows = useMemo(() => {
    const flows = treasury?.currencyFlows;

    return [
      {
        currency: "USD" as const,
        symbol: "$",
        baseBalance: vaultBalanceUsd,
        balance: adjustedVaultBalanceUsd,
        loanInflow: getLoanMovementTotal("USD", "IN"),
        loanOutflow: getLoanMovementTotal("USD", "OUT"),
        expenseOutflow: getExpenseMovementTotal("USD"),
        receivable: D(flows?.USD.receivedFromSales ?? "0"),
        payable: D(flows?.USD.paidOutInPurchases ?? "0")
      },
      {
        currency: "EUR" as const,
        symbol: "€",
        baseBalance: vaultBalanceEur,
        balance: adjustedVaultBalanceEur,
        loanInflow: getLoanMovementTotal("EUR", "IN"),
        loanOutflow: getLoanMovementTotal("EUR", "OUT"),
        expenseOutflow: getExpenseMovementTotal("EUR"),
        receivable: D(flows?.EUR.receivedFromSales ?? "0"),
        payable: D(flows?.EUR.paidOutInPurchases ?? "0")
      },
      {
        currency: "SRD" as const,
        symbol: "f",
        baseBalance: vaultBalanceSrd,
        balance: adjustedVaultBalanceSrd,
        loanInflow: getLoanMovementTotal("SRD", "IN"),
        loanOutflow: getLoanMovementTotal("SRD", "OUT"),
        expenseOutflow: getExpenseMovementTotal("SRD"),
        receivable: D(flows?.SRD.receivedFromSales ?? "0"),
        payable: D(flows?.SRD.paidOutInPurchases ?? "0")
      }
    ];
  }, [
    treasury,
    vaultBalanceUsd,
    vaultBalanceEur,
    vaultBalanceSrd,
    adjustedVaultBalanceUsd,
    adjustedVaultBalanceEur,
    adjustedVaultBalanceSrd,
    loanRows,
    opexRows
  ]);

  return {
    expenseForm,
    expenseModalOpen,
    fxRows,
    goldRows,
    grossRevenue,
    handleExpenseSave,
    handleLoanSave,
    knownPeople,
    loading,
    loanForm,
    loanModalOpen,
    loanRows,
    message,
    netPnl,
    opexRows,
    opexTotal,
    setExpenseForm,
    setExpenseModalOpen,
    setLoanForm,
    setLoanModalOpen,
    spotGramUsd,
    totalBookValueUsd,
    totalCashUsdEq,
    totalGoldOwed,
    totalMonthlyFinancialCost,
    totalMonthlyFinancialRevenue,
    totalMtmValueUsd,
    totalStorePayables,
    totalStoreReceivables,
    totalVaultGrams,
    tradingProfit,
    vaultUnrealizedPnl
  };
}
