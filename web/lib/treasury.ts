import Decimal from "decimal.js";

export type PaymentCurrency = "USD" | "SRD" | "EUR";

export type RateSnapshot = {
  usdToSrdRate: string;
  eurToUsdRate: string;
};

export type PaymentLine = {
  id: string;
  currency: PaymentCurrency;
  splitPercentage: string;
  splitAmountUsd: string;
  lastEditedField: "splitPercentage" | "splitAmountUsd";
  manualExchangeRate: string;
};

export type PaymentPreview = {
  id: string;
  splitPercentage: Decimal;
  splitAmountUsd: Decimal;
  settlementAmount: Decimal;
  error: string | null;
};

export type AmountAlert = {
  tone: "emerald" | "red";
  text: string;
};

export const ZERO = new Decimal("0");
export const HUNDRED = new Decimal("100");
export const OUNCE_IN_GRAMS = new Decimal("31.1035");
export const SUGGESTION_FACTOR = new Decimal("0.90");

export function parseDecimal(value: string, fallback = "0") {
  try {
    if (value.trim() === "") {
      return new Decimal(fallback);
    }

    return new Decimal(value);
  } catch {
    return new Decimal(fallback);
  }
}

export function parseRequiredDecimal(value: string, label: string) {
  try {
    if (value.trim() === "") {
      return { value: null as Decimal | null, error: `${label} é obrigatória.` };
    }

    return { value: new Decimal(value), error: null as string | null };
  } catch {
    return { value: null as Decimal | null, error: `${label} inválida.` };
  }
}

export function decimalText(value: Decimal) {
  return value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

export function getSuggestedRate(currency: PaymentCurrency, rate?: RateSnapshot | null) {
  if (!rate) return "";
  if (currency === "SRD") return rate.usdToSrdRate;
  if (currency === "EUR") return rate.eurToUsdRate;
  return "";
}

export function createPaymentLine(index: number, rate?: RateSnapshot | null): PaymentLine {
  return {
    id: `split-${index}`,
    currency: "USD",
    splitPercentage: "0.0000",
    splitAmountUsd: "0.0000",
    lastEditedField: "splitPercentage",
    manualExchangeRate: getSuggestedRate("USD", rate)
  };
}

export function normalizeLineByPercentage(line: PaymentLine, totalOrderValueUsd: Decimal): PaymentLine {
  const percentageValue = parseDecimal(line.splitPercentage).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const amountValue = totalOrderValueUsd.mul(percentageValue.div(HUNDRED)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  return {
    ...line,
    splitPercentage: decimalText(percentageValue),
    splitAmountUsd: decimalText(amountValue),
    lastEditedField: "splitPercentage"
  };
}

export function normalizeLineByAmount(line: PaymentLine, totalOrderValueUsd: Decimal): PaymentLine {
  const amountValue = parseDecimal(line.splitAmountUsd).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const percentageValue = totalOrderValueUsd.gt(ZERO)
    ? amountValue.div(totalOrderValueUsd).mul(HUNDRED).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    : ZERO;

  return {
    ...line,
    splitPercentage: decimalText(percentageValue),
    splitAmountUsd: decimalText(amountValue),
    lastEditedField: "splitAmountUsd"
  };
}

export function syncLineWithTotal(line: PaymentLine, totalOrderValueUsd: Decimal): PaymentLine {
  if (line.lastEditedField === "splitAmountUsd") {
    return normalizeLineByAmount(line, totalOrderValueUsd);
  }

  return normalizeLineByPercentage(line, totalOrderValueUsd);
}

export function calculateTotalAmountUsd(lines: PaymentLine[]) {
  return lines
    .reduce((acc, line) => acc.add(parseDecimal(line.splitAmountUsd)), ZERO)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function createAutofilledPaymentLine(index: number, rate: RateSnapshot | null | undefined, totalOrderValueUsd: Decimal, currentLines: PaymentLine[]) {
  const allocated = calculateTotalAmountUsd(currentLines);
  const remainingAmount = Decimal.max(totalOrderValueUsd.sub(allocated), ZERO).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const remainingPercentage = totalOrderValueUsd.gt(ZERO)
    ? remainingAmount.div(totalOrderValueUsd).mul(HUNDRED).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    : ZERO;

  return {
    ...createPaymentLine(index, rate),
    splitPercentage: decimalText(remainingPercentage),
    splitAmountUsd: decimalText(remainingAmount),
    lastEditedField: "splitAmountUsd"
  } satisfies PaymentLine;
}

export function calculatePaymentPreview(lines: PaymentLine[], totalOrderValueUsd: Decimal) {
  return lines.map((line) => {
    const parsedAmount = parseRequiredDecimal(line.splitAmountUsd, "Valor em USD");
    if (parsedAmount.error || !parsedAmount.value) {
      return { id: line.id, splitPercentage: ZERO, splitAmountUsd: ZERO, settlementAmount: ZERO, error: parsedAmount.error };
    }

    if (parsedAmount.value.lt(ZERO)) {
      return { id: line.id, splitPercentage: ZERO, splitAmountUsd: ZERO, settlementAmount: ZERO, error: "O valor do split nao pode ser negativo." };
    }

    const normalizedAmount = parsedAmount.value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const normalizedPercentage = totalOrderValueUsd.gt(ZERO)
      ? normalizedAmount.div(totalOrderValueUsd).mul(HUNDRED).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
      : ZERO;

    if (line.currency === "USD") {
      return { id: line.id, splitPercentage: normalizedPercentage, splitAmountUsd: normalizedAmount, settlementAmount: normalizedAmount, error: null };
    }

    const parsedRate = parseRequiredDecimal(line.manualExchangeRate, "Manual Exchange Rate");
    if (parsedRate.error || !parsedRate.value) {
      return { id: line.id, splitPercentage: normalizedPercentage, splitAmountUsd: normalizedAmount, settlementAmount: ZERO, error: parsedRate.error };
    }

    if (!parsedRate.value.gt(ZERO)) {
      return { id: line.id, splitPercentage: normalizedPercentage, splitAmountUsd: normalizedAmount, settlementAmount: ZERO, error: "A taxa de cambio manual deve ser maior que zero." };
    }

    if (line.currency === "SRD") {
      return {
        id: line.id,
        splitPercentage: normalizedPercentage,
        splitAmountUsd: normalizedAmount,
        settlementAmount: normalizedAmount.mul(parsedRate.value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
        error: null
      };
    }

    return {
      id: line.id,
      splitPercentage: normalizedPercentage,
      splitAmountUsd: normalizedAmount,
      settlementAmount: normalizedAmount.div(parsedRate.value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
      error: null
    };
  });
}

export function calculateTotalPercentage(lines: PaymentLine[]) {
  return lines
    .reduce((acc, line) => acc.add(parseDecimal(line.splitPercentage)), ZERO)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function buildAmountAlert(totalAssignedUsd: Decimal, totalOrderValueUsd: Decimal): AmountAlert {
  const delta = totalOrderValueUsd.sub(totalAssignedUsd).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  if (delta.eq(ZERO)) {
    return {
      tone: "emerald",
      text: `Split conferido: USD ${decimalText(totalAssignedUsd)} de USD ${decimalText(totalOrderValueUsd)}.`
    };
  }

  if (delta.gt(ZERO)) {
    return {
      tone: "red",
      text: `Split incompleto: faltam USD ${decimalText(delta)} para fechar o total de USD ${decimalText(totalOrderValueUsd)}.`
    };
  }

  return {
    tone: "red",
    text: `Split excedente: ultrapassou USD ${decimalText(delta.abs())} do total de USD ${decimalText(totalOrderValueUsd)}.`
  };
}