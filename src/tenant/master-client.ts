import crypto from "node:crypto";

import { PrismaClient } from "@prisma/client";

const MASTER_DB_URL = process.env.MASTER_DATABASE_URL?.trim();
const TENANT_CACHE_TTL_MS = 60_000;

type LicenseStatus = "ACTIVE" | "INACTIVE";

type TenantRow = {
  id: string;
  companyName: string;
  licenseStatus: LicenseStatus;
  databaseUrl: string;
};

type TenantCacheEntry = {
  expiresAt: number;
  tenant: TenantRow;
};

const tenantCache = new Map<string, TenantCacheEntry>();

const masterPrisma = new PrismaClient({
  ...(MASTER_DB_URL ? { datasourceUrl: MASTER_DB_URL } : {})
});

const ensureMasterConfigured = () => {
  if (!MASTER_DB_URL) {
    throw new Error("MASTER_DATABASE_URL is not configured.");
  }
};

export const getTenantFromMaster = async (tenantId: string): Promise<TenantRow> => {
  ensureMasterConfigured();

  const now = Date.now();
  const cached = tenantCache.get(tenantId);
  if (cached && cached.expiresAt > now) {
    return cached.tenant;
  }

  const rows = await masterPrisma.$queryRaw<TenantRow[]>`
    SELECT
      id,
      "companyName",
      "licenseStatus"::text as "licenseStatus",
      "databaseUrl"
    FROM "Tenant"
    WHERE id = ${tenantId}
    LIMIT 1
  `;

  const tenant = rows[0];
  if (!tenant) {
    throw new Error("TENANT_NOT_FOUND");
  }

  if (tenant.licenseStatus !== "ACTIVE") {
    throw new Error("TENANT_INACTIVE");
  }

  tenantCache.set(tenantId, {
    expiresAt: now + TENANT_CACHE_TTL_MS,
    tenant
  });

  return tenant;
};

export const upsertTenantInMaster = async (input: {
  id?: string;
  companyName: string;
  databaseUrl: string;
  licenseStatus?: LicenseStatus;
}): Promise<TenantRow> => {
  ensureMasterConfigured();

  const tenantId = input.id ?? crypto.randomUUID();

  const rows = await masterPrisma.$queryRaw<TenantRow[]>`
    INSERT INTO "Tenant" (id, "companyName", "licenseStatus", "databaseUrl", "updatedAt")
    VALUES (
      ${tenantId},
      ${input.companyName},
      ${input.licenseStatus ?? "ACTIVE"}::"LicenseStatus",
      ${input.databaseUrl},
      now()
    )
    ON CONFLICT ("databaseUrl")
    DO UPDATE SET
      "companyName" = EXCLUDED."companyName",
      "licenseStatus" = EXCLUDED."licenseStatus",
      "updatedAt" = now()
    RETURNING
      id,
      "companyName",
      "licenseStatus"::text as "licenseStatus",
      "databaseUrl"
  `;

  const tenant = rows[0];
  if (!tenant) {
    throw new Error("MASTER_UPSERT_FAILED");
  }

  tenantCache.set(tenant.id, {
    expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
    tenant
  });

  return tenant;
};

export const disconnectMasterPrisma = async () => {
  await masterPrisma.$disconnect();
};
