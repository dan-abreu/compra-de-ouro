import { Decimal } from "decimal.js";

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP
});

export const D = (value: Decimal.Value): Decimal => new Decimal(value);

export const q4 = (value: Decimal.Value): Decimal => D(value).toDecimalPlaces(4);

export const eq4 = (a: Decimal.Value, b: Decimal.Value): boolean => q4(a).equals(q4(b));
