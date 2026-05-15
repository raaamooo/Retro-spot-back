import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { EVENTS } from '../socketEvents';

const prisma = new PrismaClient();

export class InventoryService {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Manually update stock for an ingredient (used by inventory worker).
   * Recalculates menu item availability and emits all relevant events.
   */
  async updateStock(ingredientId: string, newQuantity: number) {
    const updatedIngredient = await prisma.ingredient.update({
      where: { id: ingredientId },
      data: { quantityAvailable: newQuantity },
    });

    // Check low stock threshold
    if (updatedIngredient.quantityAvailable > 0 && updatedIngredient.quantityAvailable <= updatedIngredient.lowStockThreshold) {
      this.io.emit(EVENTS.INVENTORY_LOW_STOCK, updatedIngredient);
    }

    // If zero or less, disable affected menu items
    if (updatedIngredient.quantityAvailable <= 0) {
      await this.disableMenuItemsUsingIngredient(updatedIngredient.id);
    } else {
      // If restocked, re-enable items that might now be available
      await this.reenableMenuItemsUsingIngredient(updatedIngredient.id);
    }

    // Emit full ingredient list and updated availability
    await this.emitFullUpdate();

    return updatedIngredient;
  }

  /**
   * Deplete inventory for all items in an order.
   * Called automatically after a new order is placed.
   */
  async depleteInventoryForOrder(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              menuItem: {
                include: { recipes: true }
              }
            }
          }
        }
      });

      if (!order) return;

      for (const orderItem of order.items) {
        for (const recipe of orderItem.menuItem.recipes) {
          const totalUsed = recipe.quantityUsed * orderItem.quantity;
          
          // Decrement ingredient
          const updatedIngredient = await prisma.ingredient.update({
            where: { id: recipe.ingredientId },
            data: { quantityAvailable: { decrement: totalUsed } }
          });

          // Check thresholds
          if (updatedIngredient.quantityAvailable > 0 && updatedIngredient.quantityAvailable <= updatedIngredient.lowStockThreshold) {
            this.io.emit(EVENTS.INVENTORY_LOW_STOCK, updatedIngredient);
          }

          // If zero or less, mark affected menu items as unavailable
          if (updatedIngredient.quantityAvailable <= 0) {
            await this.disableMenuItemsUsingIngredient(updatedIngredient.id);
          }
        }
      }

      // Emit full update after all depletions
      await this.emitFullUpdate();
    } catch (error) {
      console.error('[InventoryService:depleteInventoryForOrder] ERROR:', error);
      throw error;
    }
  }

  /**
   * Disable all menu items that depend on a depleted ingredient.
   */
  private async disableMenuItemsUsingIngredient(ingredientId: string) {
    const recipes = await prisma.recipe.findMany({
      where: { ingredientId },
      select: { menuItemId: true }
    });

    const menuItemIds = recipes.map(r => r.menuItemId);

    if (menuItemIds.length > 0) {
      await prisma.menuItem.updateMany({
        where: { id: { in: menuItemIds } },
        data: { available: false }
      });
    }
  }

  /**
   * Re-enable menu items when an ingredient is restocked.
   * Only enables if ALL recipe ingredients are now in stock.
   */
  private async reenableMenuItemsUsingIngredient(ingredientId: string) {
    // Find all menu items that use this ingredient
    const recipes = await prisma.recipe.findMany({
      where: { ingredientId },
      select: { menuItemId: true }
    });

    for (const recipe of recipes) {
      // Check if ALL ingredients for this menu item are in stock
      const allRecipes = await prisma.recipe.findMany({
        where: { menuItemId: recipe.menuItemId },
        include: { ingredient: true }
      });

      const allInStock = allRecipes.every(r => r.ingredient.quantityAvailable > 0);
      if (allInStock) {
        await prisma.menuItem.update({
          where: { id: recipe.menuItemId },
          data: { available: true }
        });
      }
    }
  }

  /**
   * Emit the full ingredient list and menu availability to all clients.
   */
  private async emitFullUpdate() {
    const ingredients = await prisma.ingredient.findMany();
    this.io.emit(EVENTS.INVENTORY_UPDATED, ingredients);

    const menuItems = await prisma.menuItem.findMany({
      select: { id: true, available: true }
    });
    this.io.emit(EVENTS.MENU_AVAILABILITY, menuItems);
  }
}
