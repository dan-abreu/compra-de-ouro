import { Currency } from "@prisma/client";

import { D, q4 } from "../lib/decimal.js";
import { DomainError } from "../lib/errors.js";

type DecimalInstance = ReturnType<typeof D>;

export type PaymentSplitInput = {
  currency: Currency;
  amount: string;
  manualExchangeRate?: string;
};

export type LockedRateSnapshot = {
  usdToSrdRate: DecimalInstance;
  eurToUsdRate: DecimalInstance;
};

export const ensureValidSplits = (splits: PaymentSplitInput[]) => {
  if (splits.length === 0) {
    throw new DomainError("At least one payment split is required.", 422, {
      code: "VALIDATION_ERROR",
      fieldErrors: { paymentSplits: "At least one payment split is required." }
    });
  }
};

export const convertSplitToUsd = (
  split: PaymentSplitInput,
  snapshot: LockedRateSnapshot | null
): DecimalInstance => {
  const amount = q4(split.amount) as DecimalInstance;
  const manualRate = split.manualExchangeRate ? (q4(split.manualExchangeRate) as DecimalInstance) : null;

  if (split.currency === Currency.USD) {
    return amount;
  }

  if (split.currency === Currency.SRD) {
    if (manualRate && manualRate.gt(0)) {
      return q4(amount.div(manualRate)) as DecimalInstance;
    }

    if (snapshot && snapshot.usdToSrdRate.gt(0)) {
      return q4(amount.div(snapshot.usdToSrdRate)) as DecimalInstance;
    }

    throw new DomainError("Manual exchange rate is required for SRD split when no daily rate is available.", 422, {
      code: "VALIDATION_ERROR",
      fieldErrors: { paymentSplits: "Informe taxa manual USD/SRD para linhas em SRD." }
    });
  }

  if (split.currency === Currency.EUR) {
    if (manualRate && manualRate.gt(0)) {
      return q4(amount.mul(manualRate)) as DecimalInstance;
    }

    if (snapshot && snapshot.eurToUsdRate.gt(0)) {
      return q4(amount.mul(snapshot.eurToUsdRate)) as DecimalInstance;
    }

    throw new DomainError("Manual exchange rate is required for EUR split when no daily rate is available.", 422, {
      code: "VALIDATION_ERROR",
      fieldErrors: { paymentSplits: "Informe taxa manual EUR/USD para linhas em EUR." }
    });
  }

  throw new DomainError("Unsupported split currency.", 422, {
    code: "VALIDATION_ERROR",
    fieldErrors: { paymentSplits: "Unsupported split currency." }
  });
};
