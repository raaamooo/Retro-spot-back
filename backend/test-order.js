const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { InventoryService } = require('./services/InventoryService.ts');
const { OrderService } = require('./services/OrderService.ts');

const ioMock = { emit: () => {} };
const inventoryService = new InventoryService(ioMock);
const orderService = new OrderService(ioMock, inventoryService);

async function main() {
  const location = await prisma.location.findFirst();
  const item = await prisma.menuItem.findFirst();

  try {
    const order = await orderService.placeOrder({
      locationId: location.id,
      customerName: 'Test',
      notes: '',
      paymentMethod: 'CASH',
      tipAmount: 0,
      subtotal: 100,
      total: 100,
      items: [
        {
          menuItemId: item.id,
          quantity: 1,
          itemPriceAtTime: 100
        }
      ]
    });
    console.log("Success", order.id);
  } catch (e) {
    console.error("Error creating order:", e);
  }
}
main().finally(() => prisma.$disconnect());
