import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Coffee Category Migration...');

  // 1. Find or create the new categories
  let hotCat = await prisma.menuCategory.findFirst({ where: { nameEn: 'Hot Coffee' } });
  if (!hotCat) {
    hotCat = await prisma.menuCategory.create({
      data: { nameEn: 'Hot Coffee', nameAr: 'قهوة ساخنة', sortOrder: 1, active: true }
    });
  }

  let icedCat = await prisma.menuCategory.findFirst({ where: { nameEn: 'Iced Coffee' } });
  if (!icedCat) {
    icedCat = await prisma.menuCategory.create({
      data: { nameEn: 'Iced Coffee', nameAr: 'قهوة باردة', sortOrder: 2, active: true }
    });
  }

  // 2. Identify the categories to migrate
  const targetCategoryNames = [
    'Espresso-Based — Classics',
    'Milk-Based — Everyday',
    'Specialty & Signature',
    'Filter & Pour-Over',
    'Traditional Egyptian'
  ];

  const categoriesToMigrate = await prisma.menuCategory.findMany({
    where: { nameEn: { in: targetCategoryNames } },
    include: { items: { include: { recipes: true } } }
  });

  for (const cat of categoriesToMigrate) {
    console.log(`Processing category: ${cat.nameEn}...`);
    for (const item of cat.items) {
      const tags = (item.tags || '').toLowerCase();
      const isHot = tags.includes('hot');
      const isIced = tags.includes('iced');
      
      // Default to Hot if no specific tags
      const effectivelyHot = isHot || (!isHot && !isIced);
      const effectivelyIced = isIced;

      if (effectivelyHot && effectivelyIced) {
        // Update the original item to be the Hot version
        await prisma.menuItem.update({
          where: { id: item.id },
          data: { categoryId: hotCat.id }
        });
        console.log(`Moved ${item.nameEn} to Hot Coffee`);

        // Create a duplicate for the Iced version
        const icedNameEn = item.nameEn.toLowerCase().startsWith('iced') ? item.nameEn : `Iced ${item.nameEn}`;
        const icedNameAr = item.nameAr.includes('آيس') ? item.nameAr : `آيس ${item.nameAr}`;
        
        const newIcedItem = await prisma.menuItem.create({
          data: {
            categoryId: icedCat.id,
            nameEn: icedNameEn,
            nameAr: icedNameAr,
            descriptionEn: item.descriptionEn,
            descriptionAr: item.descriptionAr,
            price: item.price,
            imageUrl: item.imageUrl,
            available: item.available,
            tags: item.tags,
            active: item.active
          }
        });
        
        // Copy recipes if any
        if (item.recipes && item.recipes.length > 0) {
          await prisma.recipe.createMany({
            data: item.recipes.map(r => ({
              menuItemId: newIcedItem.id,
              ingredientId: r.ingredientId,
              quantityUsed: r.quantityUsed
            }))
          });
        }
        console.log(`Created duplicate ${icedNameEn} for Iced Coffee`);

      } else if (effectivelyHot) {
        await prisma.menuItem.update({
          where: { id: item.id },
          data: { categoryId: hotCat.id }
        });
        console.log(`Moved ${item.nameEn} to Hot Coffee`);
      } else if (effectivelyIced) {
        await prisma.menuItem.update({
          where: { id: item.id },
          data: { categoryId: icedCat.id }
        });
        console.log(`Moved ${item.nameEn} to Iced Coffee`);
      }
    }

    // After moving all items, we can safely delete the old category
    await prisma.menuCategory.delete({ where: { id: cat.id } });
    console.log(`Deleted category: ${cat.nameEn}`);
  }

  console.log('Migration completed successfully!');
}

main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
