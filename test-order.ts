import { PrismaClient } from '@prisma/client';
import { InventoryService } from './services/InventoryService';
import { OrderService } from './services/OrderService';
import { Server } from 'socket.io';

const prisma = new PrismaClient();
const io = new Server();
const inv = new InventoryService(io);
const ord = new OrderService(io, inv);

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
