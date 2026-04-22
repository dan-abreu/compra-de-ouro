import { NextFunction, Request, Response } from "express";

import { extractTenantIdFromHost } from "../lib/tenant-host.js";
import { getTenantFromMaster } from "../tenant/master-client.js";
import { runWithTenantContext } from "../tenant/tenant-context.js";
import { getOrCreateTenantPrisma } from "../tenant/tenant-prisma-factory.js";

const TENANT_HEADER = "x-tenant-id";
const TENANT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,62}$/;

const extractTenantId = (req: Request): string | null => {
  const headerTenantId = req.header(TENANT_HEADER)?.trim();
  if (headerTenantId) {
    return headerTenantId;
  }

  return extractTenantIdFromHost(req.hostname);
};

const isValidTenantId = (tenantId: string) => TENANT_ID_PATTERN.test(tenantId);

export const tenantResolverMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = extractTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        message: "Tenant identifier is required in X-Tenant-ID header or subdomain.",
        code: "TENANT_ID_REQUIRED",
        fieldErrors: {}
      });
    }

    if (!isValidTenantId(tenantId)) {
      return res.status(400).json({
        message: "Tenant identifier format is invalid.",
        code: "TENANT_ID_INVALID",
        fieldErrors: {}
      });
    }

    const tenant = await getTenantFromMaster(tenantId);
    const tenantPrisma = getOrCreateTenantPrisma(tenant.databaseUrl);

    req.tenantId = tenant.id;
    req.tenantPrisma = tenantPrisma;

    return runWithTenantContext(
      {
        tenantId: tenant.id,
        tenantDatabaseUrl: tenant.databaseUrl,
        prisma: tenantPrisma
      },
      () => next()
    );
  } catch (error) {
    if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
      return res.status(404).json({
        message: "Tenant not found.",
        code: "TENANT_NOT_FOUND",
        fieldErrors: {}
      });
    }

    if (error instanceof Error && error.message === "TENANT_INACTIVE") {
      return res.status(403).json({
        message: "Tenant license is inactive.",
        code: "TENANT_INACTIVE",
        fieldErrors: {}
      });
    }

    return res.status(500).json({
      message: "Failed to resolve tenant.",
      code: "TENANT_RESOLUTION_ERROR",
      fieldErrors: {}
    });
  }
};
