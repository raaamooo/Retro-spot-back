import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const items = await prisma.menuItem.findMany();
  console.log(`Total items: ${items.length}`);
  items.slice(0, 10).forEach(i => console.log(`- ${i.nameEn}`));
}

check().finally(() => prisma.$disconnect());
