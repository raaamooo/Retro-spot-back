import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking database connectivity and contents...');
  const userCount = await prisma.user.count();
  const locationCount = await prisma.location.count();
  const categoryCount = await prisma.menuCategory.count();
  const itemCount = await prisma.menuItem.count();
  const orderCount = await prisma.order.count();

  console.log(`User Count: ${userCount}`);
  console.log(`Location Count: ${locationCount}`);
  console.log(`MenuCategory Count: ${categoryCount}`);
  console.log(`MenuItem Count: ${itemCount}`);
  console.log(`Order Count: ${orderCount}`);

  if (categoryCount > 0) {
    const categories = await prisma.menuCategory.findMany({
      include: {
        items: true,
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });
    for (const cat of categories) {
      console.log(`\nCategory: ${cat.nameEn} (${cat.nameAr}) - ID: ${cat.id}`);
      for (const item of cat.items) {
        console.log(`  - ${item.nameEn} (${item.nameAr}) - Price: ${item.price} EGP - Available: ${item.available} - Tags: ${item.tags || 'none'}`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error('Error running check:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
