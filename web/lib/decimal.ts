import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const D = (value: Decimal.Value) => new Decimal(value);

export const q4 = (value: Decimal.Value) => D(value).toDecimalPlaces(4);

export const format4 = (value: Decimal.Value) => q4(value).toFixed(4);

export const formatMoney = (value: Decimal.Value, currency: "SRD" | "USD" | "EUR") => {
  return `${currency} ${q4(value).toFixed(4)}`;
};
