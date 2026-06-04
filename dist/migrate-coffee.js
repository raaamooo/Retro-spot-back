"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCoffeeMigration = runCoffeeMigration;
async function runCoffeeMigration(prisma) {
    console.log('🚀 Starting Menu Cleanup & Category Merge migration...');
    // 1. DELETE ENTIRELY (unavailable + redundant or abandoned)
    const itemsToDelete = [
        { nameEn: 'nutella', categoryName: 'Milkshake' },
        { nameEn: 'Nescafé (3-in-1)', categoryName: 'Hot Coffee' },
        { nameEn: 'Iced Nescafé', categoryName: 'Iced Coffee' },
    ];
    for (const item of itemsToDelete) {
        const found = await prisma.menuItem.findFirst({
            where: {
                nameEn: { equals: item.nameEn, mode: 'insensitive' }
            }
        });
        if (found) {
            console.log(`Deleting item: ${found.nameEn} (${found.id})`);
            // Delete references first to avoid FK constraints
            await prisma.recipe.deleteMany({ where: { menuItemId: found.id } });
            await prisma.orderItem.deleteMany({ where: { menuItemId: found.id } });
            await prisma.menuItem.delete({ where: { id: found.id } });
            console.log(`Deleted item: ${found.nameEn}`);
        }
    }
    // 2. CREATE NEW MERGED CATEGORIES
    // A. Create or get "Sweet Corner"
    let catSweetCorner = await prisma.menuCategory.findFirst({
        where: { nameEn: 'Sweet Corner' }
    });
    if (!catSweetCorner) {
        catSweetCorner = await prisma.menuCategory.create({
            data: { nameEn: 'Sweet Corner', nameAr: 'ركن الحلويات', sortOrder: 7 }
        });
        console.log('Created Sweet Corner category');
    }
    // B. Create or get "Coffee"
    let catCoffee = await prisma.menuCategory.findFirst({
        where: { nameEn: 'Coffee' }
    });
    if (!catCoffee) {
        catCoffee = await prisma.menuCategory.create({
            data: { nameEn: 'Coffee', nameAr: 'قهوة', sortOrder: 1 }
        });
        console.log('Created Coffee category');
    }
    // 3. MERGE DESSERT CATEGORIES -> Sweet Corner
    const dessertCategories = ['Ice Cream', 'Waffle Corner', 'Yogurt Corner'];
    for (const catName of dessertCategories) {
        const cat = await prisma.menuCategory.findFirst({
            where: { nameEn: { equals: catName, mode: 'insensitive' } },
            include: { items: true }
        });
        if (cat) {
            console.log(`Merging dessert category "${catName}" into "Sweet Corner"...`);
            for (const item of cat.items) {
                // Apply singular/plural and spelling fixes
                let newNameEn = item.nameEn;
                let newNameAr = item.nameAr;
                if (item.nameEn === 'Ice Cream 2 Scoop') {
                    newNameEn = 'Ice Cream 2 Scoops';
                    newNameAr = 'ايس كريم 2 بوله';
                }
                if (item.nameEn === 'Ice Cream 3 Scoop') {
                    newNameEn = 'Ice Cream 3 Scoops';
                    newNameAr = 'ايس كريم 3 بوله';
                }
                if (item.nameEn === 'Ice Cream 4 Scoop') {
                    newNameEn = 'Ice Cream 4 Scoops';
                    newNameAr = 'ايس كريم 4 بوله';
                }
                if (item.nameEn === 'Flavor Yogurt') {
                    newNameEn = 'Flavored Yogurt';
                    newNameAr = 'زبادي فليفر';
                }
                await prisma.menuItem.update({
                    where: { id: item.id },
                    data: {
                        categoryId: catSweetCorner.id,
                        nameEn: newNameEn,
                        nameAr: newNameAr
                    }
                });
                console.log(`Moved item: ${item.nameEn} -> ${newNameEn}`);
            }
            // Delete old category
            await prisma.menuCategory.delete({ where: { id: cat.id } });
            console.log(`Deleted empty category: ${catName}`);
        }
    }
    // 4. MERGE COFFEE CATEGORIES -> Coffee
    const coffeeCategories = ['Hot Coffee', 'Iced Coffee'];
    for (const catName of coffeeCategories) {
        const cat = await prisma.menuCategory.findFirst({
            where: { nameEn: { equals: catName, mode: 'insensitive' } },
            include: { items: true }
        });
        if (cat) {
            console.log(`Merging coffee category "${catName}" into "Coffee"...`);
            const isIced = catName.toLowerCase().includes('iced');
            for (const item of cat.items) {
                // Handle tags for switching hot/iced
                let currentTags = item.tags ? item.tags.split(',').map(t => t.trim()) : [];
                const requiredTag = isIced ? 'iced' : 'hot';
                if (!currentTags.includes(requiredTag)) {
                    currentTags.push(requiredTag);
                }
                const updatedTags = currentTags.join(',');
                await prisma.menuItem.update({
                    where: { id: item.id },
                    data: {
                        categoryId: catCoffee.id,
                        tags: updatedTags
                    }
                });
                console.log(`Moved coffee item: ${item.nameEn} (Tags: ${updatedTags})`);
            }
            // Delete old category
            await prisma.menuCategory.delete({ where: { id: cat.id } });
            console.log(`Deleted empty category: ${catName}`);
        }
    }
    // 5. REMOVE EMPTY MILKSHAKE CATEGORY
    const milkshakeCat = await prisma.menuCategory.findFirst({
        where: { nameEn: { equals: 'Milkshake', mode: 'insensitive' } }
    });
    if (milkshakeCat) {
        await prisma.menuCategory.delete({ where: { id: milkshakeCat.id } });
        console.log('Deleted empty Milkshake category');
    }
    // 6. FIX ITEM NAMES & SPELLING & TITLE CASE
    const nameFixes = [
        { old: 'cocacola', newEn: 'Coca-Cola', newAr: 'كوكاكولا' },
        { old: 'Blue Berry Smoothie', newEn: 'Blueberry Smoothie', newAr: 'توت ازرق سموثي' },
        { old: 'Rasp Berry Smoothie', newEn: 'Raspberry Smoothie', newAr: 'توت احمر سموثي' },
        { old: 'Frappuchino Classic', newEn: 'Frappuccino Classic', newAr: 'فرابيتشينو كلاسيك' },
        { old: 'Frappuchino Flavor', newEn: 'Frappuccino Flavor', newAr: 'فرابيتشينو فليفر' },
        { old: 'Flavor Tea', newEn: 'Flavored Tea', newAr: 'شاي فليفر' },
        { old: 'Flavor Yogurt', newEn: 'Flavored Yogurt', newAr: 'زبادي فليفر' },
        { old: 'Strawberry Watermelon', newEn: 'Strawberry Watermelon Smoothie', newAr: 'فراوله بطيخ سموثي' },
        { old: 'Ahwa (Turkish Coffee)', newEn: 'Turkish Coffee', newAr: 'قهوة تركي' }
    ];
    for (const fix of nameFixes) {
        const items = await prisma.menuItem.findMany({
            where: { nameEn: { equals: fix.old, mode: 'insensitive' } }
        });
        for (const item of items) {
            await prisma.menuItem.update({
                where: { id: item.id },
                data: { nameEn: fix.newEn, nameAr: fix.newAr }
            });
            console.log(`Fixed name: ${item.nameEn} -> ${fix.newEn}`);
        }
    }
    // Title Case correction for all items
    const allItems = await prisma.menuItem.findMany();
    for (const item of allItems) {
        let words = item.nameEn.split(' ');
        let titleCased = words.map(w => {
            if (w.toLowerCase() === 'coca-cola')
                return 'Coca-Cola';
            if (w.toLowerCase() === 'v60')
                return 'V60';
            if (w.toLowerCase() === '3-in-1')
                return '3-in-1';
            if (w.includes('—')) {
                return w.split('—').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('—');
            }
            if (w.includes('-')) {
                return w.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('-');
            }
            // Keep parentheses contents title-cased if present, e.g. (3-in-1) -> (3-in-1)
            let cleanWord = w;
            let prefix = '';
            let suffix = '';
            if (w.startsWith('(')) {
                prefix = '(';
                cleanWord = w.slice(1);
            }
            if (w.endsWith(')')) {
                suffix = ')';
                cleanWord = cleanWord.slice(0, -1);
            }
            // If it's a specific brand or uppercase word
            if (cleanWord.toLowerCase() === 'kitkat')
                return prefix + 'KitKat' + suffix;
            const capitalized = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase();
            return prefix + capitalized + suffix;
        }).join(' ');
        if (titleCased !== item.nameEn) {
            await prisma.menuItem.update({
                where: { id: item.id },
                data: { nameEn: titleCased }
            });
            console.log(`Title cased name: "${item.nameEn}" -> "${titleCased}"`);
        }
    }
    // 7. MARK PREMIUM ITEMS AS "COMING SOON" using coming_soon tag
    const comingSoonItems = [
        'Frappe Lotus',
        'Filter Coffee — Micro Lot',
        'Filter Coffee — Premium',
        'Cold Brew',
        'Iced Filter Coffee — Premium',
        'Iced Peanut Butter Latte',
        'Nitro Cold Brew'
    ];
    for (const name of comingSoonItems) {
        const item = await prisma.menuItem.findFirst({
            where: { nameEn: { equals: name, mode: 'insensitive' } }
        });
        if (item) {
            let currentTags = item.tags ? item.tags.split(',').map(t => t.trim()) : [];
            if (!currentTags.includes('coming_soon')) {
                currentTags.push('coming_soon');
            }
            await prisma.menuItem.update({
                where: { id: item.id },
                data: {
                    tags: currentTags.join(','),
                    available: false, // Ensure unavailable for ordering
                    active: true // Keep it active so it is returned by the API
                }
            });
            console.log(`Marked item "${item.nameEn}" as Coming Soon!`);
        }
    }
    console.log('✅ Menu Restructuring & Category Merge completed successfully!');
}
if (require.main === module) {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    runCoffeeMigration(prisma)
        .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    })
        .finally(async () => {
        await prisma.$disconnect();
    });
}
