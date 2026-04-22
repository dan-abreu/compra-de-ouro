import Decimal from "decimal.js";

import { D } from "@/lib/decimal";

const safeDecimal = (value: Decimal.Value | null | undefined) => D(value ?? 0);

export const fmtUsd = (value: Decimal.Value | null | undefined, digits = 4) => `$ ${safeDecimal(value).toFixed(digits)}`;
export const fmtGold = (value: Decimal.Value | null | undefined) => `${safeDecimal(value).toFixed(4)} g`;
export const fmtCurrency = (symbol: string, value: Decimal.Value | null | undefined, digits = 4) =>
	`${symbol} ${safeDecimal(value).toFixed(digits)}`;
export const signPrefix = (value: Decimal.Value) => (D(value).gte(0) ? "+" : "");
