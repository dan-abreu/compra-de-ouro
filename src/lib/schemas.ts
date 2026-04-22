import { z } from "zod";

export const decimalString = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a positive decimal string with up to 4 places");

export const signedDecimalString = z
  .string()
  .regex(/^-?\d+(\.\d{1,4})?$/, "Must be a decimal string with up to 4 places");
