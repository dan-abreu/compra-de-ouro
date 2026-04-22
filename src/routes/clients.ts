import { Router } from "express";
import { RecordStatus } from "@prisma/client";
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

const createClientSchema = z.object({
  fullName: z.string().min(2, "Nome completo obrigatorio."),
  documentId: optionalString(2),
  phone: optionalString(4),
  address: optionalString(4),
  goldOrigin: optionalString(2),
  kycDocumentUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url("URL do documento KYC invalida.").optional()
  )
});

router.get("/", async (_req, res) => {
  try {
    const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });
    res.json(clients);
  } catch (error) {
    console.error("[clients] GET error:", error);
    return res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      fieldErrors: {}
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = createClientSchema.parse(req.body);

    const existing = payload.documentId
      ? await prisma.client.findFirst({ where: { documentId: payload.documentId } })
      : null;
    if (existing) {
      throw new DomainError("Cliente ja cadastrado com este documento.", 409, {
        code: "CLIENT_DUPLICATE_DOCUMENT",
        fieldErrors: { documentId: "Ja existe cliente com este documento." }
      });
    }

    const created = await prisma.client.create({ data: payload });
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

export { router as clientsRouter };
