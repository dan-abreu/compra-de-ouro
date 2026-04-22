import { Router } from "express";
import { z } from "zod";

import { DomainError } from "../lib/errors.js";
import { mapZodIssuesToFieldErrors } from "../lib/validation.js";
import { prisma } from "../prisma.js";

const router = Router();

const optionalString = (minLength = 1) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(minLength).optional()
  );

const createSupplierSchema = z.object({
  companyName: z.string().min(2, "Nome da empresa/comprador obrigatorio."),
  documentId: optionalString(2),
  contactName: optionalString(2),
  phone: optionalString(4),
  address: optionalString(4)
});

router.get("/", async (_req, res) => {
  const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: "desc" } });
  res.json(suppliers);
});

router.post("/", async (req, res) => {
  try {
    const payload = createSupplierSchema.parse(req.body);

    const existing = payload.documentId
      ? await prisma.supplier.findFirst({ where: { documentId: payload.documentId } })
      : null;
    if (existing) {
      throw new DomainError("Fornecedor ja cadastrado com este documento.", 409, {
        code: "SUPPLIER_DUPLICATE_DOCUMENT",
        fieldErrors: { documentId: "Ja existe fornecedor com este documento." }
      });
    }

    const created = await prisma.supplier.create({ data: payload });
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof DomainError) {
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
        fieldErrors: error.fieldErrors ?? {}
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(422).json({
        message: "Payload invalido.",
        code: "VALIDATION_ERROR",
        fieldErrors: mapZodIssuesToFieldErrors(error.issues),
        issues: error.issues
      });
    }

    return res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }
});

export { router as suppliersRouter };
