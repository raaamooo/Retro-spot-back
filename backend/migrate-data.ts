import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  const localDbPath = path.resolve(__dirname, 'prisma/dev.db');
  console.log(`📂 Using local database: ${localDbPath}`);

  if (!fs.existsSync(localDbPath)) {
    console.error('❌ Local database not found!');
    process.exit(1);
  }

  // 1. Setup Source (SQLite direct)
  const sqlite = new Database(localDbPath);

  // 2. Setup Destination (Postgres via Prisma)
  const destUrl = process.env.DATABASE_URL;
  if (!destUrl || !destUrl.startsWith('postgresql')) {
    console.error('❌ DATABASE_URL (Postgres) is missing or invalid!');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: {
      db: { url: destUrl },
    },
  });

  try {
    console.log('📡 Connected to Railway Postgres.');
    
    // 1. Categories
    console.log('📑 Migrating Categories...');
    const categories = sqlite.prepare('SELECT * FROM MenuCategory').all();
    for (const cat: any of categories) {
      await prisma.menuCategory.upsert({
        where: { id: cat.id },
        update: { nameEn: cat.nameEn, nameAr: cat.nameAr, sortOrder: cat.sortOrder },
        create: { id: cat.id, nameEn: cat.nameEn, nameAr: cat.nameAr, sortOrder: cat.sortOrder },
      });
    }

    // 2. Ingredients
    console.log('🥛 Migrating Ingredients...');
    const ingredients = sqlite.prepare('SELECT * FROM Ingredient').all();
    for (const ing: any of ingredients) {
      await prisma.ingredient.upsert({
        where: { id: ing.id },
        update: { 
          nameEn: ing.nameEn, 
          nameAr: ing.nameAr, 
          unit: ing.unit, 
          quantityAvailable: ing.quantityAvailable, 
          lowStockThreshold: ing.lowStockThreshold 
        },
        create: { 
          id: ing.id, 
          nameEn: ing.nameEn, 
          nameAr: ing.nameAr, 
          unit: ing.unit, 
          quantityAvailable: ing.quantityAvailable, 
          lowStockThreshold: ing.lowStockThreshold 
        },
      });
    }

    // 3. Menu Items
    console.log('🍔 Migrating Menu Items...');
    const items = sqlite.prepare('SELECT * FROM MenuItem').all();
    for (const item: any of items) {
      await prisma.menuItem.upsert({
        where: { id: item.id },
        update: { 
          categoryId: item.categoryId, 
          nameEn: item.nameEn, 
          nameAr: item.nameAr, 
          descriptionEn: item.descriptionEn, 
          descriptionAr: item.descriptionAr, 
          price: item.price, 
          image: item.image, 
          available: item.available === 1 
        },
        create: { 
          id: item.id, 
          categoryId: item.categoryId, 
          nameEn: item.nameEn, 
          nameAr: item.nameAr, 
          descriptionEn: item.descriptionEn, 
          descriptionAr: item.descriptionAr, 
          price: item.price, 
          image: item.image, 
          available: item.available === 1 
        },
      });
    }

    // 4. Recipes
    console.log('🔗 Migrating Recipes...');
    const recipes = sqlite.prepare('SELECT * FROM Recipe').all();
    for (const rec: any of recipes) {
      await prisma.recipe.upsert({
        where: { id: rec.id },
        update: { 
          menuItemId: rec.menuItemId, 
          ingredientId: rec.ingredientId, 
          quantityUsed: rec.quantityUsed 
        },
        create: { 
          id: rec.id, 
          menuItemId: rec.menuItemId, 
          ingredientId: rec.ingredientId, 
          quantityUsed: rec.quantityUsed 
        },
      });
    }

    // 5. Locations
    console.log('📍 Migrating Locations...');
    const locations = sqlite.prepare('SELECT * FROM Location').all();
    for (const loc: any of locations) {
      await prisma.location.upsert({
        where: { id: loc.id },
        update: { name: loc.name, type: loc.type, qrCode: loc.qrCode },
        create: { id: loc.id, name: loc.name, type: loc.type, qrCode: loc.qrCode },
      });
    }

    console.log('\n✨ SUCCESS! All local data has been migrated to the cloud.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

migrate();
