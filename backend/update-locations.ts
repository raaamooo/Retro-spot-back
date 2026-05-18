import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing locations...');
  await prisma.location.deleteMany({});

  const newLocations = [
    { name: 'Table 1', type: 'table' },
    { name: 'Table 2', type: 'table' },
    { name: 'Table 3', type: 'table' },
    { name: 'Table 4', type: 'table' },
    { name: 'Table 5', type: 'table' },
    { name: 'Table 6', type: 'table' },
    { name: 'Room', type: 'room' },
    { name: 'Outdoor 1', type: 'table' },
    { name: 'Outdoor 2', type: 'table' },
  ];

  console.log('Creating new locations...');
  for (const loc of newLocations) {
    await prisma.location.create({
      data: loc
    });
  }

  console.log('Successfully updated locations!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
