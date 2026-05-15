import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. User / Admin - Idempotent with upsert
  const adminEmail = 'admin@retrospot.com';
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Super Admin',
      role: 'manager',
      email: adminEmail,
      passwordHash: hashedPassword,
    },
  });

  // 2. Locations - Check if they exist to avoid duplicates
  const locationsCount = await prisma.location.count();
  if (locationsCount === 0) {
    const table1 = await prisma.location.create({
      data: { name: 'Table 1', type: 'table' },
    });
    const room1 = await prisma.location.create({
      data: { name: 'Workspace Room A', type: 'room' },
    });
    console.log('Locations created');
  }

  // 3. Categories - Idempotent
  const categoriesCount = await prisma.menuCategory.count();
  if (categoriesCount === 0) {
    const catCoffee = await prisma.menuCategory.create({
      data: { nameEn: 'Coffee', nameAr: 'قهوة', sortOrder: 1 },
    });
    const catPastry = await prisma.menuCategory.create({
      data: { nameEn: 'Pastries', nameAr: 'معجنات', sortOrder: 2 },
    });

    // 4. Ingredients
    const coffeeBeans = await prisma.ingredient.create({
      data: { nameEn: 'Coffee Beans', nameAr: 'حبوب البن', unit: 'gram', quantityAvailable: 5000, lowStockThreshold: 1000 },
    });
    const milk = await prisma.ingredient.create({
      data: { nameEn: 'Milk', nameAr: 'حليب', unit: 'ml', quantityAvailable: 10000, lowStockThreshold: 2000 },
    });

    // 5. Menu Items & Recipes
    const espresso = await prisma.menuItem.create({
      data: {
        categoryId: catCoffee.id,
        nameEn: 'Retro Espresso',
        nameAr: 'اسبريسو ريترو',
        price: 3.5,
        available: true,
      },
    });

    await prisma.recipe.create({
      data: {
        menuItemId: espresso.id,
        ingredientId: coffeeBeans.id,
        quantityUsed: 18, // 18 grams
      },
    });

    const latte = await prisma.menuItem.create({
      data: {
        categoryId: catCoffee.id,
        nameEn: 'Vinyl Latte',
        nameAr: 'لاتيه فاينل',
        price: 4.5,
        available: true,
      },
    });

    await prisma.recipe.create({
      data: { menuItemId: latte.id, ingredientId: coffeeBeans.id, quantityUsed: 18 },
    });
    await prisma.recipe.create({
      data: { menuItemId: latte.id, ingredientId: milk.id, quantityUsed: 200 }, // 200 ml
    });
    console.log('Categories, items and recipes created');
  }

  // 6. News
  const newsCount = await prisma.news.count();
  if (newsCount === 0) {
    await prisma.news.create({
      data: {
        titleEn: 'Grand Opening',
        titleAr: 'الافتتاح الكبير',
        type: 'event',
        active: true,
      },
    });
    console.log('News created');
  }

  console.log('✅ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
