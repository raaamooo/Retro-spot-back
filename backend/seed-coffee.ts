import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const catCoffee = await prisma.menuCategory.findFirst({
    where: { nameEn: 'Coffee' }
  });

  if (!catCoffee) {
    console.error('Coffee category not found!');
    return;
  }

  const coffees = [
    { nameEn: 'Double Espresso', nameAr: 'دبل اسبريسو', price: 45 },
    { nameEn: 'Americano', nameAr: 'أمريكانو', price: 50 },
    { nameEn: 'Cortado', nameAr: 'كورتادو', price: 60 },
    { nameEn: 'Flat White', nameAr: 'فلات وايت', price: 65 },
    { nameEn: 'Cappuccino', nameAr: 'كابتشينو', price: 65 },
    { nameEn: 'Spanish Latte', nameAr: 'سبانش لاتيه', price: 75 },
    { nameEn: 'V60', nameAr: 'في 60', price: 80 },
    { nameEn: 'Cold Brew', nameAr: 'كولد برو', price: 85 },
    { nameEn: 'Ice White Mocha', nameAr: 'ايس وايت موكا', price: 80 },
    { nameEn: 'Macchiato', nameAr: 'ميكياتو', price: 55 },
    { nameEn: 'Turkish Coffee', nameAr: 'قهوة تركية', price: 40 },
    { nameEn: 'French Press', nameAr: 'فرنش بريس', price: 60 },
  ];

  for (const c of coffees) {
    const exists = await prisma.menuItem.findFirst({ where: { nameEn: c.nameEn } });
    if (!exists) {
      await prisma.menuItem.create({
        data: {
          categoryId: catCoffee.id,
          nameEn: c.nameEn,
          nameAr: c.nameAr,
          price: c.price,
          available: true,
          active: true,
        }
      });
      console.log(`Added ${c.nameEn}`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
