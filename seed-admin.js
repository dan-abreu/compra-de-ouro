import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'admin@compra-ouro.local' },
    update: {},
    create: {
      email: 'admin@compra-ouro.local',
      fullName: 'Admin User',
      passwordHash: 'hash',
      role: 'ADMIN'
    }
  });
  console.log('User created:', user.id);
  await prisma.$disconnect();
}

main().catch(console.error);
