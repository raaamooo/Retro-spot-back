"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * seed-restore-menu.ts
 * Re-seeds all missing categories and items that were lost during the
 * migrate-coffee.ts migration. Uses exact prices/names from the original
 * menu export (retro-spot-menu.txt dated 2026-05-23).
 *
 * Safe to run multiple times — skips items/categories that already exist.
 *
 * Run with: npx ts-node seed-restore-menu.ts
 */
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Original cocktails from the live menu (6 items, NOT the seed-drinks.ts ones)
const ORIGINAL_COCKTAILS = [
    { nameEn: 'Blue Lemon Cocktail', nameAr: 'ليمون ازرق كوكتيل', price: 80 },
    { nameEn: 'Florida', nameAr: 'فلوريدا', price: 80 },
    { nameEn: 'Froment', nameAr: 'فرومنت', price: 80 },
    { nameEn: 'Lemus', nameAr: 'ليموس', price: 80 },
    { nameEn: 'Mango Energy', nameAr: 'مانجو انيرجي', price: 80 },
    { nameEn: 'Three Flowers', nameAr: 'ثري فلورز', price: 80 },
];
const CATEGORIES_AND_ITEMS = [
    {
        nameEn: 'Frappe', nameAr: 'فرابيه', sortOrder: 3,
        items: [
            { nameEn: 'Frappe Vanilla', nameAr: 'فرابيه فانيليا', price: 80, available: true },
            { nameEn: 'Frappe Caramel', nameAr: 'فرابيه كراميل', price: 80, available: true },
            { nameEn: 'Frappe Mocha', nameAr: 'فرابيه موكا', price: 85, available: true },
            { nameEn: 'Frappe Nutella', nameAr: 'فرابيه نوتيلا', price: 90, available: true },
            { nameEn: 'Frappe Hazelnut', nameAr: 'فرابيه بندق', price: 85, available: true },
            { nameEn: 'Frappe Lotus', nameAr: 'فرابيه لوتس', price: 90, available: false },
            { nameEn: 'Frappe Pistachio', nameAr: 'فرابيه فستق', price: 95, available: true },
            { nameEn: 'Frappuchino Classic', nameAr: 'فرابيتشينو كلاسيك', price: 85, available: true },
            { nameEn: 'Frappuchino Flavor', nameAr: 'فرابيتشينو فليفر', price: 90, available: true },
        ],
    },
    {
        nameEn: 'Smoothie', nameAr: 'سموثي', sortOrder: 4,
        items: [
            { nameEn: 'Kiwi Smoothie', nameAr: 'كيوي سموثي', price: 75, available: true },
            { nameEn: 'Mango Smoothie', nameAr: 'مانجو سموثي', price: 75, available: true },
            { nameEn: 'Blue Berry Smoothie', nameAr: 'توت ازرق سموثي', price: 65, available: true },
            { nameEn: 'Rasp Berry Smoothie', nameAr: 'توت احمر سموثي', price: 65, available: true },
            { nameEn: 'Strawberry Smoothie', nameAr: 'فراوله سموثي', price: 65, available: true },
            { nameEn: 'Lemon Smoothie', nameAr: 'ليمون سموثي', price: 50, available: true },
            { nameEn: 'Lemon Mint Smoothie', nameAr: 'ليمون نعناع سموثي', price: 55, available: true },
            { nameEn: 'Pineapple Smoothie', nameAr: 'اناناس سموثي', price: 65, available: true },
            { nameEn: 'Peach Smoothie', nameAr: 'خوخ سموثي', price: 65, available: true },
            { nameEn: 'Watermelon Smoothie', nameAr: 'بطيخ سموثي', price: 65, available: true },
            { nameEn: 'Green Apple Smoothie', nameAr: 'تفاح اخضر سموثي', price: 90, available: true },
            { nameEn: 'Strawberry Watermelon', nameAr: 'فراوله بطيخ', price: 75, available: true },
        ],
    },
    {
        nameEn: 'Tea & Herbs', nameAr: 'شاي واعشاب', sortOrder: 8,
        items: [
            { nameEn: 'Tea', nameAr: 'شاي', price: 30, available: true },
            { nameEn: 'Flavor Tea', nameAr: 'شاي فليفر', price: 40, available: true },
            { nameEn: 'Karak Tea', nameAr: 'كرك', price: 40, available: true },
            { nameEn: 'Green Tea', nameAr: 'شاي اخضر', price: 40, available: true },
            { nameEn: 'Milk Tea', nameAr: 'شاي حليب', price: 50, available: true },
            { nameEn: 'Herbal Mix', nameAr: 'خلطة اعشاب', price: 40, available: true },
            { nameEn: 'Cinnamon Milk', nameAr: 'قرفه حليب', price: 40, available: true },
            { nameEn: 'Lemon Herbs', nameAr: 'ليمون اعشاب', price: 40, available: true },
            { nameEn: 'Anise', nameAr: 'ينسون', price: 30, available: true },
            { nameEn: 'Ginger', nameAr: 'جنزبيل', price: 40, available: true },
            { nameEn: 'Mint Tea', nameAr: 'نعناع', price: 30, available: true },
        ],
    },
    {
        nameEn: 'Fresh Juice', nameAr: 'عصائر فريش', sortOrder: 9,
        items: [
            { nameEn: 'Mango Juice', nameAr: 'مانجو فريش', price: 65, available: true },
            { nameEn: 'Strawberry Juice', nameAr: 'فراوله فريش', price: 65, available: true },
            { nameEn: 'Orange Juice', nameAr: 'برتقال فريش', price: 65, available: true },
            { nameEn: 'Kiwi Juice', nameAr: 'كيوي فريش', price: 75, available: true },
            { nameEn: 'Lemon Juice', nameAr: 'ليمون فريش', price: 45, available: true },
            { nameEn: 'Lemon Mint Juice', nameAr: 'ليمون نعناع فريش', price: 50, available: true },
            { nameEn: 'French Lemon', nameAr: 'ليمون فرنساوي', price: 65, available: true },
            { nameEn: 'Watermelon Juice', nameAr: 'بطيخ فريش', price: 60, available: true },
            { nameEn: 'Pomegranate Juice', nameAr: 'رمان فريش', price: 65, available: true },
            { nameEn: 'Banana Milk', nameAr: 'موز حليب', price: 60, available: true },
            { nameEn: 'Dates Milk', nameAr: 'بلح حليب', price: 60, available: true },
            { nameEn: 'Guava Milk', nameAr: 'جوافه حليب', price: 75, available: true },
            { nameEn: 'Guava Juice', nameAr: 'جوافه فريش', price: 65, available: true },
            { nameEn: 'Strawberry Milk Juice', nameAr: 'فراوله حليب', price: 75, available: true },
            { nameEn: 'Avocado Juice', nameAr: 'افوكادو فريش', price: 105, available: true },
        ],
    },
    {
        nameEn: 'Waffle Corner', nameAr: 'ركن الوافل', sortOrder: 10,
        items: [
            { nameEn: 'Nutella Waffle', nameAr: 'وافل نوتيلا', price: 65, available: true },
            { nameEn: 'Lotus Waffle', nameAr: 'وافل لوتس', price: 75, available: true },
            { nameEn: 'Pistachio Waffle', nameAr: 'وافل فستق', price: 75, available: true },
            { nameEn: 'White Chocolate Waffle', nameAr: 'وافل وايت شوكليت', price: 65, available: true },
            { nameEn: 'Waffle Mix Sauce', nameAr: 'وافل ميكس صوص', price: 85, available: true },
        ],
    },
    {
        nameEn: 'Yogurt Corner', nameAr: 'ركن الزبادي', sortOrder: 11,
        items: [
            { nameEn: 'Honey Yogurt', nameAr: 'زبادي عسل', price: 80, available: true },
            { nameEn: 'Flavor Yogurt', nameAr: 'زبادي فليفر', price: 95, available: true },
        ],
    },
    {
        nameEn: 'Ice Cream', nameAr: 'ايس كريم', sortOrder: 12,
        items: [
            { nameEn: 'Ice Cream 2 Scoop', nameAr: 'ايس كريم 2 بوله', price: 50, available: true },
            { nameEn: 'Ice Cream 3 Scoop', nameAr: 'ايس كريم 3 بوله', price: 65, available: true },
            { nameEn: 'Ice Cream 4 Scoop', nameAr: 'ايس كريم 4 بوله', price: 75, available: true },
        ],
    },
    {
        nameEn: 'Soft Drinks', nameAr: 'مشروبات غازية', sortOrder: 13,
        items: [
            { nameEn: 'Pepsi', nameAr: 'بيبسي', price: 40, available: true },
            { nameEn: 'Sprite', nameAr: 'سبرايت', price: 40, available: true },
            { nameEn: 'Coca-Cola', nameAr: 'كوكاكولا', price: 40, available: true },
        ],
    },
];
async function main() {
    console.log('🔄 Restoring missing menu categories and items...\n');
    // ── Step 1: Restore the original 6 cocktails ──────────────────────────────
    let cocktailCat = await prisma.menuCategory.findFirst({ where: { nameEn: 'Cocktails' } });
    if (!cocktailCat) {
        cocktailCat = await prisma.menuCategory.create({
            data: { nameEn: 'Cocktails', nameAr: 'كوكتيلات', sortOrder: 5, active: true },
        });
        console.log('✅ Created Cocktails category');
    }
    for (const item of ORIGINAL_COCKTAILS) {
        const exists = await prisma.menuItem.findFirst({
            where: { nameEn: item.nameEn, categoryId: cocktailCat.id },
        });
        if (!exists) {
            await prisma.menuItem.create({
                data: {
                    categoryId: cocktailCat.id,
                    nameEn: item.nameEn,
                    nameAr: item.nameAr,
                    price: item.price,
                    available: true,
                    active: true,
                },
            });
            console.log(`  + ${item.nameEn} (${item.price} EGP)`);
        }
        else {
            console.log(`  ⏭️  ${item.nameEn} already exists`);
        }
    }
    // ── Step 2: Restore all missing categories ─────────────────────────────────
    for (const catData of CATEGORIES_AND_ITEMS) {
        let category = await prisma.menuCategory.findFirst({
            where: { nameEn: catData.nameEn },
        });
        if (!category) {
            category = await prisma.menuCategory.create({
                data: {
                    nameEn: catData.nameEn,
                    nameAr: catData.nameAr,
                    sortOrder: catData.sortOrder,
                    active: true,
                },
            });
            console.log(`\n✅ Created category: ${catData.nameEn}`);
        }
        else {
            // Ensure category is active
            if (!category.active) {
                await prisma.menuCategory.update({
                    where: { id: category.id },
                    data: { active: true },
                });
                console.log(`\n🔄 Reactivated category: ${catData.nameEn}`);
            }
            else {
                console.log(`\n⏭️  Category exists: ${catData.nameEn}`);
            }
        }
        for (const item of catData.items) {
            const exists = await prisma.menuItem.findFirst({
                where: { nameEn: item.nameEn, categoryId: category.id },
            });
            if (!exists) {
                await prisma.menuItem.create({
                    data: {
                        categoryId: category.id,
                        nameEn: item.nameEn,
                        nameAr: item.nameAr,
                        price: item.price,
                        available: item.available,
                        active: true,
                    },
                });
                console.log(`  + ${item.nameEn} (${item.price} EGP)${!item.available ? ' [OFF]' : ''}`);
            }
            else {
                console.log(`  ⏭️  ${item.nameEn} already exists`);
            }
        }
    }
    // ── Step 3: Deactivate empty placeholder categories ────────────────────────
    const emptyCats = ['Pastries', 'Sweet Corner'];
    for (const name of emptyCats) {
        const cat = await prisma.menuCategory.findFirst({ where: { nameEn: name } });
        if (cat) {
            const count = await prisma.menuItem.count({ where: { categoryId: cat.id, active: true } });
            if (count === 0) {
                await prisma.menuCategory.update({
                    where: { id: cat.id },
                    data: { active: false },
                });
                console.log(`\n🗑️  Deactivated empty category: ${name}`);
            }
        }
    }
    // ── Summary ─────────────────────────────────────────────────────────────────
    const totalCats = await prisma.menuCategory.count({ where: { active: true } });
    const totalItems = await prisma.menuItem.count({ where: { active: true } });
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  ✅ Done! ${totalCats} active categories, ${totalItems} active items`);
    console.log(`═══════════════════════════════════════════`);
}
main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
