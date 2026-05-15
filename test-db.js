const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const items = await prisma.menuItem.findMany();
  console.log('Items:', items.length);
  const locations = await prisma.location.findMany();
  console.log('Locations:', locations.length);
}
main().finally(() => prisma.$disconnect());
