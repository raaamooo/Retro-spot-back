import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const items = await prisma.menuItem.findMany({
    include: { recipes: true }
  });
  const missing = items.filter(i => i.recipes.length === 0);
  console.log(`Missing recipes for ${missing.length} items:`);
  missing.forEach(i => console.log(`- ${i.nameEn}`));
}

check().finally(() => prisma.$disconnect());
