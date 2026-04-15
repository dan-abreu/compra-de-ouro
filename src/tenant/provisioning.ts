import { execSync } from "node:child_process";
import crypto from "node:crypto";

import { PrismaClient, UserRole } from "@prisma/client";

import { upsertTenantInMaster } from "./master-client.js";

const POSTGRES_ADMIN_URL = process.env.POSTGRES_ADMIN_URL?.trim();

const ensureProvisioningConfig = () => {
  if (!POSTGRES_ADMIN_URL) {
    throw new Error("POSTGRES_ADMIN_URL is not configured.");
  }

  if (!process.env.MASTER_DATABASE_URL?.trim()) {
    throw new Error("MASTER_DATABASE_URL is not configured.");
  }
};

const buildTenantDatabaseName = (companyName: string) => {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 36);

  return `tenant_${slug}_${Date.now()}`;
};

const buildTenantDatabaseUrl = (databaseName: string): string => {
  const adminUrl = new URL(POSTGRES_ADMIN_URL!);
  adminUrl.pathname = `/${databaseName}`;
  return adminUrl.toString();
};

const createTenantDatabase = async (databaseName: string) => {
  const adminPrisma = new PrismaClient({ datasourceUrl: POSTGRES_ADMIN_URL });
  try {
    // CREATE DATABASE não aceita bind param no postgres, por isso unsafe com nome sanitizado.
    await adminPrisma.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await adminPrisma.$disconnect();
  }
};

const runTenantMigrations = (tenantDatabaseUrl: string) => {
  execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: tenantDatabaseUrl
    },
    cwd: process.cwd()
  });
};

const seedTenantAdmin = async (input: {
  tenantDatabaseUrl: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}) => {
  const tenantPrisma = new PrismaClient({ datasourceUrl: input.tenantDatabaseUrl });
  try {
    const created = await tenantPrisma.user.create({
      data: {
        fullName: input.adminName,
        email: input.adminEmail,
        // Compatibilidade com autenticação atual de legado.
        passwordHash: input.adminPassword,
        role: UserRole.ADMIN
      }
    });

    return created;
  } finally {
    await tenantPrisma.$disconnect();
  }
};

export const provisionNewTenant = async (input: {
  companyName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}) => {
  ensureProvisioningConfig();

  const tenantId = crypto.randomUUID();
  const dbName = buildTenantDatabaseName(input.companyName);
  const tenantDatabaseUrl = buildTenantDatabaseUrl(dbName);

  await createTenantDatabase(dbName);
  runTenantMigrations(tenantDatabaseUrl);
  const adminUser = await seedTenantAdmin({
    tenantDatabaseUrl,
    adminName: input.adminName,
    adminEmail: input.adminEmail,
    adminPassword: input.adminPassword
  });

  const tenant = await upsertTenantInMaster({
    id: tenantId,
    companyName: input.companyName,
    databaseUrl: tenantDatabaseUrl,
    licenseStatus: "ACTIVE"
  });

  return {
    tenant,
    adminUser: {
      id: adminUser.id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      role: adminUser.role
    }
  };
};
