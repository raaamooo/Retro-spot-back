"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const InventoryService_1 = require("./services/InventoryService");
const OrderService_1 = require("./services/OrderService");
const socket_io_1 = require("socket.io");
const prisma = new client_1.PrismaClient();
const io = new socket_io_1.Server();
const inv = new InventoryService_1.InventoryService(io);
const ord = new OrderService_1.OrderService(io, inv);
async function test() {
    const item = await prisma.menuItem.findFirst();
    const loc = await prisma.location.findFirst();
    if (!item || !loc) {
        console.log("Seed data missing");
        process.exit(1);
    }
    console.log('Placing order for:', item.nameEn);
    const orderData = {
        locationId: loc.id,
        customerName: 'Test Customer',
        items: [
            {
                menuItemId: item.id,
                quantity: 2,
                itemPriceAtTime: item.price
            }
        ],
        subtotal: item.price * 2,
        total: item.price * 2
    };
    const newOrder = await ord.placeOrder(orderData);
    console.log('Order placed:', newOrder.id);
    // Verify inventory
    const ingredient = await prisma.ingredient.findFirst();
    console.log('Current ingredient quantity:', ingredient?.quantityAvailable);
    process.exit(0);
}
test();
