"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const t = await prisma.location.findFirst({ where: { name: 'Takeaway' } });
    if (!t) {
        await prisma.location.create({ data: { name: 'Takeaway', type: 'takeaway' } });
        console.log("Created Takeaway location");
    }
    else {
        console.log("Takeaway location already exists:", t);
    }
}
main().finally(() => prisma.$disconnect());
