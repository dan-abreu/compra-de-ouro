import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const [tenantDatabaseUrl, adminEmail] = process.argv.slice(2);

if (!tenantDatabaseUrl || !adminEmail) {
  console.error("Usage: tsx src/scripts/seed-tenant-runtime-data.ts <tenantDatabaseUrl> <adminEmail>");
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: tenantDatabaseUrl });

async function main() {
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!adminUser) {
    throw new Error(`Admin user not found for email: ${adminEmail}`);
  }

  await prisma.vault.upsert({
    where: { code: "MAIN" },
    update: {
      balanceGoldGrams: "0.0000",
      balanceUsd: "10000.0000",
      balanceEur: "0.0000",
      balanceSrd: "0.0000",
      openGoldGrams: "0.0000",
      openGoldAcquisitionCostUsd: "0.0000"
    },
    create: {
      code: "MAIN",
      balanceGoldGrams: "0.0000",
      balanceUsd: "10000.0000",
      balanceEur: "0.0000",
      balanceSrd: "0.0000",
      openGoldGrams: "0.0000",
      openGoldAcquisitionCostUsd: "0.0000"
    }
  });

  await prisma.dailyRate.upsert({
    where: { rateDate: new Date("2026-04-15T00:00:00.000Z") },
    update: {
      goldPricePerGramUsd: "62.0000",
      usdToSrdRate: "37.5000",
      eurToUsdRate: "1.1000",
      createdById: adminUser.id
    },
    create: {
      rateDate: new Date("2026-04-15T00:00:00.000Z"),
      goldPricePerGramUsd: "62.0000",
      usdToSrdRate: "37.5000",
      eurToUsdRate: "1.1000",
      createdById: adminUser.id
    }
  });

  console.log(
    JSON.stringify(
      {
        seeded: true,
        tenantDatabaseUrl,
        adminUserId: adminUser.id
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
