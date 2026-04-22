import test from "node:test";
import assert from "node:assert/strict";

import { D } from "./decimal.js";
import { calculateEffectiveFineGoldWeight, calculateOrderTotalUsd } from "./order-pricing.js";

test("calculateEffectiveFineGoldWeight applies purity percentage to physical weight", () => {
  const result = calculateEffectiveFineGoldWeight(D("10.0000"), D("75.0000"));
  assert.equal(result.toFixed(4), "7.5000");
});

test("calculateOrderTotalUsd uses effective fine gold weight times negotiated price", () => {
  const result = calculateOrderTotalUsd(D("10.0000"), D("75.0000"), D("70.0000"));
  assert.equal(result.toFixed(4), "525.0000");
});

test("calculateOrderTotalUsd keeps four-decimal rounding consistent", () => {
  const result = calculateOrderTotalUsd(D("12.3456"), D("91.6000"), D("73.2199"));
  assert.equal(result.toFixed(4), "828.0146");
});