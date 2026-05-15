"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function check() {
    const items = await prisma.menuItem.findMany();
    console.log(`Total items: ${items.length}`);
    items.slice(0, 10).forEach(i => console.log(`- ${i.nameEn}`));
}
check().finally(() => prisma.$disconnect());
