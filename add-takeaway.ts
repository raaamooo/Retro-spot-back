import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const t = await prisma.location.findFirst({ where: { name: 'Takeaway' } });
  if (!t) {
    await prisma.location.create({ data: { name: 'Takeaway', type: 'takeaway' } });
    console.log("Created Takeaway location");
  } else {
    console.log("Takeaway location already exists:", t);
  }
}
main().finally(() => prisma.$disconnect());
