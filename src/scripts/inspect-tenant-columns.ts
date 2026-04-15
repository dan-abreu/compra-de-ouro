import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const [tenantDatabaseUrl] = process.argv.slice(2);

if (!tenantDatabaseUrl) {
  console.error("Usage: tsx src/scripts/inspect-tenant-columns.ts <tenantDatabaseUrl>");
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: tenantDatabaseUrl });

async function main() {
  const rows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('DailyRate', 'PurchaseOrder', 'SalesOrder', 'PaymentSplit', 'Vault')
    ORDER BY table_name, ordinal_position
  `;

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
