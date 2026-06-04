"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
const prisma = new client_1.PrismaClient();
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
    const records = (0, sync_1.parse)(fileContent.replace(/^\uFEFF/, ''), {
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
    const categoryNames = [...new Set(records.map((r) => r.Category.trim()))];
    const categoryMap = new Map();
    let sortOrder = 0;
    for (const catName of categoryNames) {
        if (!catName)
            continue;
        const cat = await prisma.menuCategory.create({
            data: {
                nameEn: catName,
                nameAr: catName, // Fallback if no AR provided
                sortOrder: sortOrder++,
            }
        });
        categoryMap.set(catName, cat.id);
    }
    console.log(`Created ${categoryMap.size} categories.`);
    let imported = 0;
    for (const row of records) {
        const catName = row.Category.trim();
        if (!catName)
            continue;
        const categoryId = categoryMap.get(catName);
        if (!categoryId)
            continue;
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
