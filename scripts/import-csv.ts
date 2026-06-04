import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables so the script works locally connecting to the remote db
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();
const csvPath = path.join(__dirname, '../../Data/Retro Spot Menu Items 2df0b7aadaf74a819425c5d4b7cf4f66.csv');

async function main() {
  console.log('Reading CSV...');
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  
  // First line is header: Name EN,Available,Category,Name AR,Notes,Price
  const items = lines.slice(1).map(line => {
    // split by comma. Since the CSV structure provided doesn't seem to contain commas inside the values (except notes which we can join back)
    // Actually, looking at the CSV: Frappuchino Flavor,Yes,Frappe,فرابيتشينو فليفر,Caramel - Hazelnut - Vanilla - Salted Caramel - Chocolate,$120.00
    // There are NO commas inside the values. The notes use hyphens.
    const parts = line.split(',');
    const nameEn = parts[0];
    const availableStr = parts[1];
    const categoryStr = parts[2];
    const nameAr = parts[3];
    const notesStr = parts[4];
    const priceStr = parts[5];
    
    // Normalize Price: Strip '$' and parse float
    const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    
    // Normalize Available: 'Yes' -> true
    const available = availableStr.trim().toLowerCase() === 'yes' || availableStr.trim().toLowerCase() === 'true';
    
    // Normalize Category
    const categoryName = categoryStr.trim();
    
    // Normalize Notes: Store empty as null
    const notes = notesStr.trim().length > 0 ? notesStr.trim() : null;
    
    return { nameEn, nameAr, categoryName, price, available, notes };
  });

  console.log(`Parsed ${items.length} items from CSV.`);

  // 1. Remove all current menu items (and their recipes to avoid foreign key violations)
  console.log('Deleting ALL current menu items and recipes as requested...');
  await prisma.recipe.deleteMany({});
  const deletedItems = await prisma.menuItem.deleteMany({});
  console.log(`Deleted ${deletedItems.count} existing menu items.`);

  // 2. Load existing categories
  const existingCategories = await prisma.menuCategory.findMany();
  const categoryMap = new Map();
  for (const c of existingCategories) {
    categoryMap.set(c.nameEn.toLowerCase(), c);
  }

  console.log('Starting Import...');

  for (const item of items) {
    // Ensure Category exists
    let category = categoryMap.get(item.categoryName.toLowerCase());
    if (!category) {
      console.log(`Creating missing category: ${item.categoryName}`);
      category = await prisma.menuCategory.create({
        data: {
          nameEn: item.categoryName,
          nameAr: item.categoryName, // Can't guess Arabic if missing, use same
          sortOrder: categoryMap.size
        }
      });
      categoryMap.set(item.categoryName.toLowerCase(), category);
    }

    // Insert new item
    await prisma.menuItem.create({
      data: {
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        price: item.price,
        available: item.available,
        descriptionEn: item.notes,
        categoryId: category.id,
        active: true
      }
    });
  }

  // After import, run a quick count query grouped by category
  console.log('\n--- IMPORT SUMMARY BY CATEGORY ---');
  const allItems = await prisma.menuItem.findMany({
    include: { category: true }
  });

  const categoryCounts: Record<string, number> = {};
  for (const i of allItems) {
    const catName = i.category.nameEn;
    if (!categoryCounts[catName]) categoryCounts[catName] = 0;
    categoryCounts[catName]++;
  }

  for (const catName of Object.keys(categoryCounts)) {
    console.log(`${catName}: ${categoryCounts[catName]} items`);
  }

  console.log('Import successful!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
