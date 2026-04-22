import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { PrismaClient as MasterPrismaClient } from "../generated/master-client/index.js";

const master = new MasterPrismaClient();

async function main() {
  const tenants = await master.tenant.findMany({
    select: { id: true, companyName: true, databaseUrl: true },
    orderBy: { createdAt: "asc" }
  });

  for (const tenant of tenants) {
    const prisma = new PrismaClient({ datasourceUrl: tenant.databaseUrl });

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SecurityConfig" (
          "key" VARCHAR(120) NOT NULL,
          "value" TEXT,
          "updatedById" VARCHAR(64),
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SecurityConfig_pkey" PRIMARY KEY ("key")
        )
      `);

      console.log(`[ok] ${tenant.id} (${tenant.companyName})`);
    } catch (error) {
      console.error(`[error] ${tenant.id} (${tenant.companyName})`, error);
    } finally {
      await prisma.$disconnect();
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await master.$disconnect();
  });
