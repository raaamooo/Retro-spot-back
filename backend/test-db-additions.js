const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const additions = await prisma.addition.findMany();
  console.log('Additions:', additions.length);
}
main().finally(() => prisma.$disconnect());
