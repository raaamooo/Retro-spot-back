import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting CSV Import...');
  const csvPath = path.join(__dirname, '../Data/Retro Spot Menu Items 2df0b7aadaf74a819425c5d4b7cf4f66.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at:', csvPath);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV
  // Note: Handle the BOM (Byte Order Mark) if it exists
  const records = parse(fileContent.replace(/^\uFEFF/, ''), {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Found ${records.length} records in CSV.`);

  console.log('Wiping old menu data...');
  // Wipe orders first to avoid foreign key constraints
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  
  // Wipe recipe to allow menu item deletion
  await prisma.recipe.deleteMany({});
  
  await prisma.menuItem.deleteMany({});
  await prisma.menuCategory.deleteMany({});
  console.log('Old menu data wiped.');

  // Extract unique categories
  const categoryNames = [...new Set(records.map((r: any) => r.Category.trim()))];
  
  const categoryMap = new Map<string, string>();
  
  let sortOrder = 0;
  for (const catName of categoryNames) {
    if (!catName) continue;
    const cat = await prisma.menuCategory.create({
      data: {
        nameEn: catName as string,
        nameAr: catName as string, // Fallback if no AR provided
        sortOrder: sortOrder++,
      }
    });
    categoryMap.set(catName as string, cat.id);
  }
  
  console.log(`Created ${categoryMap.size} categories.`);

  let imported = 0;
  for (const row of records as any[]) {
    const catName = row.Category.trim();
    if (!catName) continue;
    
    const categoryId = categoryMap.get(catName);
    if (!categoryId) continue;

    // Parse price e.g. "$105.00" -> 105
    const priceStr = row.Price.replace(/[^0-9.]/g, '');
    const price = parseFloat(priceStr) || 0;

    const available = row.Available.trim().toLowerCase() === 'yes';

    await prisma.menuItem.create({
      data: {
        categoryId,
        nameEn: row['Name EN'].trim(),
        nameAr: row['Name AR'].trim(),
        descriptionEn: row.Notes ? row.Notes.trim() : null,
        descriptionAr: row.Notes ? row.Notes.trim() : null,
        price,
        available,
        active: true,
        imageUrl: null, // Wipe images as requested
      }
    });
    imported++;
  }

  console.log(`Successfully imported ${imported} menu items.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
