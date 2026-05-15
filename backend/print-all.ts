import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const items = await prisma.menuItem.findMany();
  items.forEach(i => console.log(i.nameEn));
}

check().finally(() => prisma.$disconnect());
