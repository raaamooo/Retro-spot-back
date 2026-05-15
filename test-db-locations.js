const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const locations = await prisma.location.findMany();
  console.log(locations);
}
main().finally(() => prisma.$disconnect());
