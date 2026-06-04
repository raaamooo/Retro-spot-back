"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    // 1. User / Admin - Idempotent with upsert
    const adminEmail = 'admin@retrospot.com';
    const hashedPassword = await bcryptjs_1.default.hash('admin123', 10);
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
        for (const loc of newLocations) {
            await prisma.location.create({ data: loc });
        }
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
        // 4. Ingredients (v2 schema: currentStock, minimumStock, costPerUnit)
        const coffeeBeans = await prisma.ingredient.create({
            data: { nameEn: 'Coffee Beans', nameAr: 'حبوب البن', unit: 'gram', currentStock: 5000, minimumStock: 1000, costPerUnit: 0.15, category: 'dry_goods' },
        });
        const milk = await prisma.ingredient.create({
            data: { nameEn: 'Milk', nameAr: 'حليب', unit: 'ml', currentStock: 10000, minimumStock: 2000, costPerUnit: 0.02, category: 'dairy' },
        });
        // 5. Menu Items & Recipes (v2 schema: quantityRequired)
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
                quantityRequired: 18, // 18 grams
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
            data: { menuItemId: latte.id, ingredientId: coffeeBeans.id, quantityRequired: 18 },
        });
        await prisma.recipe.create({
            data: { menuItemId: latte.id, ingredientId: milk.id, quantityRequired: 200 }, // 200 ml
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
