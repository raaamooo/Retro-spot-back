import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LocationData {
  name: string;
  type: string;
}

interface CategoryData {
  nameEn: string;
  nameAr: string;
  sortOrder: number;
}

interface MenuItemData {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  categoryName: string;
  tags: string;
  price: number;
}

const LOCATIONS_TO_CREATE: LocationData[] = [
  { name: 'Table 1', type: 'table' },
  { name: 'Table 2', type: 'table' },
  { name: 'Table 3', type: 'table' },
  { name: 'Table 4', type: 'table' },
  { name: 'Table 5', type: 'table' },
  { name: 'Table 6', type: 'table' },
  { name: 'Room', type: 'room' },
  { name: 'Outdoor 1', type: 'table' },
  { name: 'Outdoor 2', type: 'table' },
  { name: 'Takeaway', type: 'takeaway' } // Ensure takeaway location exists!
];

const CATEGORIES_TO_ENSURE: CategoryData[] = [
  { nameEn: 'Pastries', nameAr: 'معجنات', sortOrder: 1 },
  { nameEn: 'Espresso-Based — Classics', nameAr: 'كلاسيكيات الإسبريسو', sortOrder: 2 },
  { nameEn: 'Milk-Based — Everyday', nameAr: 'مشروبات الحليب اليومية', sortOrder: 3 },
  { nameEn: 'Specialty & Signature', nameAr: 'مشروبات سبيشالتي المتميزة', sortOrder: 4 },
  { nameEn: 'Filter & Pour-Over', nameAr: 'قهوة مقطرة ومفلترة', sortOrder: 5 },
  { nameEn: 'Traditional Egyptian', nameAr: 'قهوة مصرية تقليدية', sortOrder: 6 }
];

const ITEMS_TO_ADD: MenuItemData[] = [
  // Espresso-Based — Classics
  {
    nameEn: 'Espresso',
    nameAr: 'إسبريسو',
    descriptionEn: 'Single or double shot, short and intense',
    descriptionAr: 'جرعة سينجل أو دبل، مركزة وقوية',
    categoryName: 'Espresso-Based — Classics',
    tags: 'hot',
    price: 45
  },
  {
    nameEn: 'Macchiato',
    nameAr: 'ماكياتو',
    descriptionEn: 'Espresso with a small amount of steamed milk or foam',
    descriptionAr: 'إسبريسو مع كمية صغيرة من الحليب المبخر أو الرغوة',
    categoryName: 'Espresso-Based — Classics',
    tags: 'hot,iced',
    price: 50
  },
  {
    nameEn: 'Cortado',
    nameAr: 'كورتادو',
    descriptionEn: 'Equal parts espresso and warm milk, minimal foam',
    descriptionAr: 'أجزاء متساوية من الإسبريسو والحليب الدافئ، رغوة خفيفة',
    categoryName: 'Espresso-Based — Classics',
    tags: 'hot',
    price: 55
  },
  {
    nameEn: 'Americano',
    nameAr: 'أمريكانو',
    descriptionEn: 'Espresso diluted with hot or cold water',
    descriptionAr: 'إسبريسو مخفف بالماء الساخن أو البارد',
    categoryName: 'Espresso-Based — Classics',
    tags: 'hot,iced',
    price: 45
  },
  {
    nameEn: 'Flat White',
    nameAr: 'فلات وايت',
    descriptionEn: 'Double ristretto with velvety microfoam, smaller than a latte',
    descriptionAr: 'دبل ريستريتو مع رغوة مخملية ناعمة، أصغر من اللاتيه',
    categoryName: 'Espresso-Based — Classics',
    tags: 'hot',
    price: 60
  },
  // Milk-Based — Everyday
  {
    nameEn: 'Cappuccino',
    nameAr: 'كابوتشينو',
    descriptionEn: 'Espresso, steamed milk, and thick foam in equal thirds',
    descriptionAr: 'إسبريسو، حليب مبخر، ورغوة غنية بنسب متساوية',
    categoryName: 'Milk-Based — Everyday',
    tags: 'hot,iced',
    price: 50
  },
  {
    nameEn: 'Latte',
    nameAr: 'لاتيه',
    descriptionEn: 'Espresso with a large pour of steamed milk and light foam',
    descriptionAr: 'إسبريسو مع كمية وفيرة من الحليب المبخر ورغوة خفيفة',
    categoryName: 'Milk-Based — Everyday',
    tags: 'hot,iced',
    price: 55
  },
  {
    nameEn: 'Mocha',
    nameAr: 'موكا',
    descriptionEn: 'Espresso, chocolate syrup, steamed milk, and whipped cream',
    descriptionAr: 'إسبريسو، صوص الشوكولاتة، حليب مبخر، وكريمة مخفوقة',
    categoryName: 'Milk-Based — Everyday',
    tags: 'hot,iced',
    price: 65
  },
  {
    nameEn: 'White Mocha',
    nameAr: 'وايت موكا',
    descriptionEn: 'Espresso with white chocolate sauce and steamed milk',
    descriptionAr: 'إسبريسو مع صوص الشوكولاتة البيضاء والحليب المبخر',
    categoryName: 'Milk-Based — Everyday',
    tags: 'hot,iced',
    price: 70
  },
  // Specialty & Signature
  {
    nameEn: 'Spanish Latte',
    nameAr: 'سبانش لاتيه',
    descriptionEn: 'Espresso, condensed milk, and steamed milk — slightly sweet',
    descriptionAr: 'إسبريسو، حليب مكثف محلى، وحليب مبخر — محلى وخفيف',
    categoryName: 'Specialty & Signature',
    tags: 'hot,iced',
    price: 70
  },
  {
    nameEn: 'Pistachio Latte',
    nameAr: 'بيستاشيو لاتيه',
    descriptionEn: 'Espresso with pistachio syrup and steamed milk',
    descriptionAr: 'إسبريسو مع صوص الفستق الفاخر والحليب المبخر',
    categoryName: 'Specialty & Signature',
    tags: 'hot,iced',
    price: 90
  },
  {
    nameEn: 'Honey Buzz Latte',
    nameAr: 'هاني باز لاتيه',
    descriptionEn: 'Espresso with honey, oat milk, and cinnamon',
    descriptionAr: 'إسبريسو مع عسل طبيعي، حليب الشوفان، ولمسة قرفة',
    categoryName: 'Specialty & Signature',
    tags: 'hot,iced',
    price: 90
  },
  {
    nameEn: 'Peanut Butter Latte',
    nameAr: 'بينات باتر لاتيه',
    descriptionEn: 'Espresso blended with peanut butter syrup and milk',
    descriptionAr: 'إسبريسو ممزوج بصوص زبدة الفول السوداني الغني والحليب',
    categoryName: 'Specialty & Signature',
    tags: 'hot,iced',
    price: 90
  },
  {
    nameEn: 'Caramel Latte',
    nameAr: 'كراميل لاتيه',
    descriptionEn: 'Espresso, caramel sauce, and steamed milk',
    descriptionAr: 'إسبريسو، صوص كراميل، وحليب مبخر',
    categoryName: 'Specialty & Signature',
    tags: 'hot,iced',
    price: 75
  },
  {
    nameEn: 'Vanilla Latte',
    nameAr: 'فانيلا لاتيه',
    descriptionEn: 'Espresso with vanilla syrup and steamed milk',
    descriptionAr: 'إسبريسو مع صوص الفانيليا العطرة والحليب المبخر',
    categoryName: 'Specialty & Signature',
    tags: 'hot,iced',
    price: 70
  },
  // Filter & Pour-Over
  {
    nameEn: 'Filter Coffee — Premium',
    nameAr: 'قهوة فلتر ممتازة',
    descriptionEn: 'Single-origin drip brew, clean and nuanced',
    descriptionAr: 'قهوة فلتر مقطرة بسلالة فردية، نكهة واضحة ونقية',
    categoryName: 'Filter & Pour-Over',
    tags: 'hot,iced',
    price: 80
  },
  {
    nameEn: 'Filter Coffee — Micro Lot',
    nameAr: 'قهوة فلتر مايكرو لوت',
    descriptionEn: 'Rare single-origin with tasting notes card',
    descriptionAr: 'محصول مايكرو لوت نادر بسلالة فردية، مع كارت إيحاءات',
    categoryName: 'Filter & Pour-Over',
    tags: 'hot',
    price: 120
  },
  {
    nameEn: 'Cold Brew',
    nameAr: 'كولد برو',
    descriptionEn: 'Coffee steeped in cold water for 12–24 hours, smooth and low-acid',
    descriptionAr: 'قهوة محضرة بالتقطير البارد لمدة 12-24 ساعة، غنية وقليلة الحموضة',
    categoryName: 'Filter & Pour-Over',
    tags: 'iced',
    price: 80
  },
  {
    nameEn: 'Nitro Cold Brew',
    nameAr: 'نايترو كولد برو',
    descriptionEn: 'Cold brew infused with nitrogen, creamy and frothy',
    descriptionAr: 'كولد برو غني بالنيتروجين، قوام كريمي رغوي فائق النعومة',
    categoryName: 'Filter & Pour-Over',
    tags: 'iced',
    price: 100
  },
  // Traditional Egyptian
  {
    nameEn: 'Ahwa (Turkish Coffee)',
    nameAr: 'قهوة تركي (قهوة)',
    descriptionEn: 'Finely ground coffee boiled in a cezve, served unfiltered — the classic',
    descriptionAr: 'بن مطحون ناعم ومغلي في كنكة، تقدم غير مصفاة — المذاق الكلاسيكي الأصيل',
    categoryName: 'Traditional Egyptian',
    tags: 'hot',
    price: 15
  },
  {
    nameEn: 'Nescafé (3-in-1)',
    nameAr: 'نسكافيه (3 في 1)',
    descriptionEn: 'Instant coffee with creamer and sugar',
    descriptionAr: 'قهوة سريعة التحضير مع مبيض وسكر',
    categoryName: 'Traditional Egyptian',
    tags: 'hot',
    price: 15
  },
  {
    nameEn: 'Iced Nescafé',
    nameAr: 'أيس نسكافيه',
    descriptionEn: 'Whipped instant coffee poured over ice with milk',
    descriptionAr: 'قهوة سريعة التحضير مخفوقة ومصبوبة فوق الثلج مع الحليب',
    categoryName: 'Traditional Egyptian',
    tags: 'iced',
    price: 20
  }
];

async function main() {
  console.log('Clearing existing locations and related operational data...');
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.waiterCall.deleteMany({});
  await prisma.receiptGroup.deleteMany({});
  await prisma.location.deleteMany({});

  console.log('Creating new locations...');
  for (const loc of LOCATIONS_TO_CREATE) {
    await prisma.location.create({
      data: loc
    });
  }
  console.log('Successfully updated locations!');

  // Explicitly remove "Blended & Frozen" category and its items if they exist
  const catToDelete = await prisma.menuCategory.findFirst({
    where: { nameEn: { equals: 'Blended & Frozen', mode: 'insensitive' } }
  });
  if (catToDelete) {
    console.log(`Found category "${catToDelete.nameEn}" to delete. Cleaning up recipes and items...`);
    const itemsToDelete = await prisma.menuItem.findMany({
      where: { categoryId: catToDelete.id },
      select: { id: true }
    });
    const itemIds = itemsToDelete.map(item => item.id);
    await prisma.recipe.deleteMany({
      where: { menuItemId: { in: itemIds } }
    });
    await prisma.menuItem.deleteMany({
      where: { categoryId: catToDelete.id }
    });
    await prisma.menuCategory.delete({
      where: { id: catToDelete.id }
    });
    console.log('Successfully deleted Blended & Frozen category, recipes, and items.');
  }

  // Explicitly remove "Coffee" category and its items if they exist
  const coffeeCategories = await prisma.menuCategory.findMany({
    where: { nameEn: { equals: 'Coffee', mode: 'insensitive' } }
  });
  for (const coffeeCat of coffeeCategories) {
    console.log(`Found old category "${coffeeCat.nameEn}" to delete. Cleaning up recipes and items...`);
    const itemsToDelete = await prisma.menuItem.findMany({
      where: { categoryId: coffeeCat.id },
      select: { id: true }
    });
    const itemIds = itemsToDelete.map(item => item.id);
    await prisma.recipe.deleteMany({
      where: { menuItemId: { in: itemIds } }
    });
    await prisma.menuItem.deleteMany({
      where: { categoryId: coffeeCat.id }
    });
    await prisma.menuCategory.delete({
      where: { id: coffeeCat.id }
    });
    console.log(`Successfully deleted category "${coffeeCat.nameEn}", recipes, and items.`);
  }

  console.log('Ensuring categories exist...');
  const categoryMap: Record<string, string> = {};
  for (const catData of CATEGORIES_TO_ENSURE) {
    let cat = await prisma.menuCategory.findFirst({
      where: {
        nameEn: { equals: catData.nameEn, mode: 'insensitive' }
      }
    });

    if (!cat) {
      cat = await prisma.menuCategory.create({
        data: {
          nameEn: catData.nameEn,
          nameAr: catData.nameAr,
          sortOrder: catData.sortOrder,
          active: true
        }
      });
      console.log(`Created Category: ${cat.nameEn}`);
    } else {
      console.log(`Category exists: ${cat.nameEn}`);
    }
    categoryMap[catData.nameEn.toLowerCase()] = cat.id;
  }

  console.log('Ensuring menu items exist...');
  let addedCount = 0;
  let skippedCount = 0;

  for (const itemData of ITEMS_TO_ADD) {
    const existingItem = await prisma.menuItem.findFirst({
      where: {
        nameEn: { equals: itemData.nameEn, mode: 'insensitive' }
      }
    });

    if (existingItem) {
      skippedCount++;
      continue;
    }

    const categoryId = categoryMap[itemData.categoryName.toLowerCase()];
    if (!categoryId) {
      console.error(`⚠️ Category not found for item ${itemData.nameEn}: ${itemData.categoryName}`);
      continue;
    }

    await prisma.menuItem.create({
      data: {
        categoryId,
        nameEn: itemData.nameEn,
        nameAr: itemData.nameAr,
        descriptionEn: itemData.descriptionEn,
        descriptionAr: itemData.descriptionAr,
        price: itemData.price,
        available: true,
        tags: itemData.tags,
        active: true
      }
    });
    addedCount++;
  }

  console.log(`Menu seeding completed. Added: ${addedCount}, Skipped (Already Exist): ${skippedCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
