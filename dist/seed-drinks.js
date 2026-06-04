"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    // Create or get Cocktails category
    let catCocktails = await prisma.menuCategory.findFirst({
        where: { nameEn: 'Cocktails' }
    });
    if (!catCocktails) {
        catCocktails = await prisma.menuCategory.create({
            data: { nameEn: 'Cocktails', nameAr: 'كوكتيلات', sortOrder: 5 }
        });
        console.log('Created Cocktails category');
    }
    // Create or get Milkshakes category
    let catMilkshakes = await prisma.menuCategory.findFirst({
        where: { nameEn: 'Milkshakes' }
    });
    if (!catMilkshakes) {
        catMilkshakes = await prisma.menuCategory.create({
            data: { nameEn: 'Milkshakes', nameAr: 'ميلك شيك', sortOrder: 6 }
        });
        console.log('Created Milkshakes category');
    }
    const cocktails = [
        { nameEn: 'Banana Strawberry', nameAr: 'فراولة وموز', price: 75 },
        { nameEn: 'Mango Kiwi', nameAr: 'مانجو وكيوي', price: 85 },
        { nameEn: 'Piña Colada', nameAr: 'بينا كولادا', price: 95 },
    ];
    for (const c of cocktails) {
        const exists = await prisma.menuItem.findFirst({ where: { nameEn: c.nameEn, categoryId: catCocktails.id } });
        if (!exists) {
            await prisma.menuItem.create({
                data: {
                    categoryId: catCocktails.id,
                    nameEn: c.nameEn,
                    nameAr: c.nameAr,
                    price: c.price,
                    available: true,
                    active: true,
                }
            });
            console.log(`Added Cocktail: ${c.nameEn}`);
        }
    }
    const milkshakes = [
        { nameEn: 'Nutella', nameAr: 'نوتيلا', price: 80 },
        { nameEn: 'Oreo', nameAr: 'أوريو', price: 85 },
        { nameEn: 'Caramel', nameAr: 'كراميل', price: 85 },
        { nameEn: 'Chocolate', nameAr: 'شوكولاتة', price: 80 },
        { nameEn: 'Vanilla', nameAr: 'فانيليا', price: 80 },
        { nameEn: 'KitKat', nameAr: 'كيت كات', price: 85 },
        { nameEn: 'Snickers', nameAr: 'سنيكرز', price: 85 },
        { nameEn: 'Pistachio', nameAr: 'فستق', price: 90 },
        { nameEn: 'Lotus', nameAr: 'لوتس', price: 80 },
        { nameEn: 'Mix Berry', nameAr: 'ميكس بيري', price: 85 },
        { nameEn: 'Blueberry', nameAr: 'توت أزرق', price: 80 },
        { nameEn: 'Strawberry', nameAr: 'فراولة', price: 80 },
        { nameEn: 'Peach', nameAr: 'خوخ', price: 80 },
        { nameEn: 'Mango', nameAr: 'مانجو', price: 80 },
    ];
    for (const m of milkshakes) {
        const exists = await prisma.menuItem.findFirst({ where: { nameEn: m.nameEn, categoryId: catMilkshakes.id } });
        if (!exists) {
            await prisma.menuItem.create({
                data: {
                    categoryId: catMilkshakes.id,
                    nameEn: m.nameEn,
                    nameAr: m.nameAr,
                    price: m.price,
                    available: true,
                    active: true,
                }
            });
            console.log(`Added Milkshake: ${m.nameEn}`);
        }
    }
}
main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
