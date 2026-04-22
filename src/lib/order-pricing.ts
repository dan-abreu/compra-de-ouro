import { D, q4 } from "./decimal.js";

type DecimalInstance = ReturnType<typeof D>;

export const calculateEffectiveFineGoldWeight = (
  physicalWeight: DecimalInstance,
  purityPercentage: DecimalInstance
): DecimalInstance => {
  return q4(physicalWeight.mul(purityPercentage.div(100))) as DecimalInstance;
};

export const calculateOrderTotalUsd = (
  physicalWeight: DecimalInstance,
  purityPercentage: DecimalInstance,
  negotiatedPricePerGramUsd: DecimalInstance
): DecimalInstance => {
  const effectiveFineGoldWeight = calculateEffectiveFineGoldWeight(physicalWeight, purityPercentage);
  return q4(effectiveFineGoldWeight.mul(negotiatedPricePerGramUsd)) as DecimalInstance;
};