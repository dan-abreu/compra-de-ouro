require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

(async () => {
  const masterUrl = process.env.MASTER_DATABASE_URL;
  if (!masterUrl) throw new Error('MASTER_DATABASE_URL not configured');

  const master = new PrismaClient({ datasourceUrl: masterUrl });
  const tenants = await master.$queryRawUnsafe(
    'SELECT id, "companyName" as "companyName", "databaseUrl" as "databaseUrl" FROM "Tenant" WHERE "licenseStatus" = ''ACTIVE'' ORDER BY "createdAt" DESC'
  );

  const results = [];

  for (const tenant of tenants) {
    const prisma = new PrismaClient({ datasourceUrl: tenant.databaseUrl });
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE IF EXISTS "Vault" ADD COLUMN IF NOT EXISTS "openGoldAcquisitionCostUsd" DECIMAL(18,4)'
      );

      await prisma.$executeRawUnsafe(
        'UPDATE "Vault" SET "balanceUsd" = 25000.0000, "balanceEur" = 3500.0000, "balanceSrd" = 120000.0000, "openGoldAcquisitionCostUsd" = COALESCE("openGoldAcquisitionCostUsd", 0) WHERE "code" = ''MAIN'''
      );

      const updated = await prisma.$queryRawUnsafe(
        'SELECT "code", "balanceUsd", "balanceEur", "balanceSrd" FROM "Vault" WHERE "code" = ''MAIN'' LIMIT 1'
      );

      results.push({
        tenantId: tenant.id,
        companyName: tenant.companyName,
        updated: updated[0] ?? null
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  await master.$disconnect();
  console.log(JSON.stringify({ updatedTenants: results.length, results }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
