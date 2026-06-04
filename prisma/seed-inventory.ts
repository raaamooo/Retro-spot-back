/**
 * seed-inventory.ts
 * Seeds real ingredients and recipes for every menu item in the DB.
 * Run with: npx ts-node prisma/seed-inventory.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing old ingredient/recipe data...');
  await prisma.recipe.deleteMany();
  await prisma.ingredient.deleteMany();

  console.log('🥛 Creating ingredients...');

  // ── Core bases ──────────────────────────────────────────────────────────────
  const milk         = await ing('Milk',             'حليب',           'ml',    10000, 2000);
  const iceCream     = await ing('Ice Cream Base',   'قاعدة آيس كريم', 'ml',    5000,  1000);
  const yogurtBase   = await ing('Yogurt Base',      'قاعدة يوغرت',    'ml',    4000,  800);
  const honey        = await ing('Honey',            'عسل',            'ml',    2000,  400);

  // ── Tea / Herbs ─────────────────────────────────────────────────────────────
  const teaBag       = await ing('Tea Bags',         'أكياس شاي',      'piece', 500,   100);
  const greenTeaBag  = await ing('Green Tea Bags',   'شاي أخضر',       'piece', 300,   60);
  const herbalMix    = await ing('Herbal Mix',       'خلطة أعشاب',     'gram',  2000,  400);
  const cinnamon     = await ing('Cinnamon',         'قرفة',           'gram',  500,   100);
  const anise        = await ing('Anise',            'ينسون',          'gram',  500,   100);
  const ginger       = await ing('Ginger',           'زنجبيل',         'gram',  500,   100);
  const mint         = await ing('Mint',             'نعناع',          'gram',  500,   100);
  const karak        = await ing('Karak Spice',      'خلطة كرك',       'gram',  500,   100);

  // ── Fruits (fresh) ──────────────────────────────────────────────────────────
  const mango        = await ing('Mango',            'مانجو',          'gram',  5000,  1000);
  const strawberry   = await ing('Strawberry',       'فراولة',         'gram',  4000,  800);
  const kiwi         = await ing('Kiwi',             'كيوي',           'gram',  3000,  600);
  const blueberry    = await ing('Blueberry',        'توت أزرق',       'gram',  3000,  600);
  const raspberry    = await ing('Raspberry',        'توت',            'gram',  3000,  600);
  const passionFruit = await ing('Passion Fruit',    'فاكهة الاطار',   'gram',  3000,  600);
  const lemon        = await ing('Lemon',            'ليمون',          'piece', 200,   40);
  const pineapple    = await ing('Pineapple',        'أناناس',         'gram',  4000,  800);
  const peach        = await ing('Peach',            'خوخ',            'gram',  3000,  600);
  const watermelon   = await ing('Watermelon',       'بطيخ',           'gram',  5000,  1000);
  const greenApple   = await ing('Green Apple',      'تفاح أخضر',      'gram',  3000,  600);
  const orange       = await ing('Orange',           'برتقال',         'piece', 200,   40);
  const guava        = await ing('Guava',            'جوافة',          'gram',  3000,  600);
  const banana       = await ing('Banana',           'موز',            'piece', 150,   30);
  const pomegranate  = await ing('Pomegranate',      'رمان',           'gram',  3000,  600);
  const avocado      = await ing('Avocado',          'أفوكادو',        'piece', 100,   20);
  const dates        = await ing('Dates',            'تمر',            'gram',  2000,  400);

  // ── Frappe / Coffee base ─────────────────────────────────────────────────────
  const frappeMix    = await ing('Frappe Mix',       'مزيج فرابيه',    'gram',  5000,  1000);
  const coffeeBeans  = await ing('Coffee Beans',     'حبوب قهوة',      'gram',  5000,  1000);
  const vanilla      = await ing('Vanilla Syrup',    'شراب فانيليا',   'ml',    2000,  400);
  const caramel      = await ing('Caramel Syrup',    'شراب كراميل',    'ml',    2000,  400);
  const mocha        = await ing('Mocha Syrup',      'شراب موكا',      'ml',    2000,  400);
  const nutella      = await ing('Nutella',          'نوتيلا',         'gram',  3000,  600);
  const hazelnut     = await ing('Hazelnut Syrup',   'شراب بندق',      'ml',    2000,  400);
  const lotus        = await ing('Lotus Paste',      'معجون لوتس',     'gram',  2000,  400);
  const pistachio    = await ing('Pistachio Paste',  'معجون فستق',     'gram',  2000,  400);
  const whitChoc     = await ing('White Chocolate',  'شوكولاتة بيضاء', 'gram',  2000,  400);

  // ── Waffle ───────────────────────────────────────────────────────────────────
  const waffleMix    = await ing('Waffle Mix',       'خلطة وافل',      'gram',  5000,  1000);

  // ── Cocktail syrups / blends ──────────────────────────────────────────────
  const blueSyrup    = await ing('Blue Curacao Syrup','شراب أزرق',     'ml',    2000,  400);
  const floridaBlend = await ing('Florida Blend',    'خلطة فلوريدا',   'gram',  2000,  400);
  const flowerBlend  = await ing('Flower Blend',     'خلطة ورد',       'gram',  2000,  400);
  const fromentBlend = await ing('Froment Blend',    'خلطة فرومون',    'gram',  2000,  400);
  const lemusBlend   = await ing('Lemus Blend',      'خلطة ليموس',     'gram',  2000,  400);

  console.log('📋 Fetching all menu items...');
  const items = await prisma.menuItem.findMany({ select: { id: true, nameEn: true } });

  const itemMap: Record<string, string> = {};
  items.forEach(i => { itemMap[i.nameEn] = i.id; });

  console.log('🔗 Creating recipes...');

  // ── Helper to link item → ingredient ────────────────────────────────────────
  const recipe = async (nameEn: string, ingredientId: string, qty: number) => {
    const menuItemId = itemMap[nameEn];
    if (!menuItemId) { console.warn(`  ⚠️  Item not found: "${nameEn}"`); return; }
    await prisma.recipe.create({ data: { menuItemId, ingredientId, quantityUsed: qty } });
  };

  // ── Tea & Herbs ──────────────────────────────────────────────────────────────
  await recipe('Tea',          teaBag.id,       1);
  await recipe('Tea',          milk.id,         50);
  await recipe('Flavor Tea',   teaBag.id,       1);
  await recipe('Karak Tea',    karak.id,        5);
  await recipe('Karak Tea',    milk.id,         150);
  await recipe('Green Tea',    greenTeaBag.id,  1);
  await recipe('Milk Tea',     teaBag.id,       1);
  await recipe('Milk Tea',     milk.id,         150);
  await recipe('Herbal Mix',   herbalMix.id,    10);
  await recipe('Cinnamon Milk',cinnamon.id,     5);
  await recipe('Cinnamon Milk',milk.id,         200);
  await recipe('Lemon Herbs',  lemon.id,        1);
  await recipe('Lemon Herbs',  herbalMix.id,    5);
  await recipe('Anise',        anise.id,        10);
  await recipe('Ginger',       ginger.id,       10);
  await recipe('Mint Tea',     mint.id,         10);
  await recipe('Mint Tea',     teaBag.id,       1);

  // ── Smoothies ────────────────────────────────────────────────────────────────
  await recipe('Kiwi Smoothie',             kiwi.id,        200);
  await recipe('Kiwi Smoothie',             milk.id,        100);
  await recipe('Mango Smoothie',            mango.id,       200);
  await recipe('Mango Smoothie',            milk.id,        100);
  await recipe('Blue Berry Smoothie',       blueberry.id,   150);
  await recipe('Blue Berry Smoothie',       milk.id,        100);
  await recipe('Rasp Berry Smoothie',       raspberry.id,   150);
  await recipe('Rasp Berry Smoothie',       milk.id,        100);
  await recipe('Passion Fruit Smoothie',    passionFruit.id,150);
  await recipe('Passion Fruit Smoothie',    milk.id,        100);
  await recipe('Strawberry Smoothie',       strawberry.id,  200);
  await recipe('Strawberry Smoothie',       milk.id,        100);
  await recipe('Lemon Smoothie',            lemon.id,       2);
  await recipe('Lemon Smoothie',            milk.id,        150);
  await recipe('Lemon Mint Smoothie',       lemon.id,       2);
  await recipe('Lemon Mint Smoothie',       mint.id,        10);
  await recipe('Lemon Mint Smoothie',       milk.id,        150);
  await recipe('Blue Lemon Smoothie',       lemon.id,       2);
  await recipe('Blue Lemon Smoothie',       blueSyrup.id,   30);
  await recipe('Blue Lemon Smoothie',       milk.id,        100);
  await recipe('Pineapple Smoothie',        pineapple.id,   200);
  await recipe('Pineapple Smoothie',        milk.id,        100);
  await recipe('Peach Smoothie',            peach.id,       200);
  await recipe('Peach Smoothie',            milk.id,        100);
  await recipe('Watermelon Smoothie',       watermelon.id,  200);
  await recipe('Watermelon Smoothie',       milk.id,        100);
  await recipe('Green Apple Smoothie',      greenApple.id,  200);
  await recipe('Green Apple Smoothie',      milk.id,        100);
  await recipe('Mango Passion Fruit',       mango.id,       150);
  await recipe('Mango Passion Fruit',       passionFruit.id,100);
  await recipe('Mango Passion Fruit',       milk.id,        100);
  await recipe('Strawberry Watermelon',     strawberry.id,  100);
  await recipe('Strawberry Watermelon',     watermelon.id,  150);
  await recipe('Strawberry Watermelon',     milk.id,        100);

  // ── Fresh Juice ──────────────────────────────────────────────────────────────
  await recipe('Mango Juice',         mango.id,       250);
  await recipe('Strawberry Juice',    strawberry.id,  250);
  await recipe('Guava Juice',         guava.id,       250);
  await recipe('Orange Juice',        orange.id,      3);
  await recipe('Kiwi Juice',          kiwi.id,        200);
  await recipe('Lemon Juice',         lemon.id,       3);
  await recipe('Lemon Mint Juice',    lemon.id,       3);
  await recipe('Lemon Mint Juice',    mint.id,        10);
  await recipe('French Lemon',        lemon.id,       3);
  await recipe('French Lemon',        milk.id,        50);
  await recipe('Watermelon Juice',    watermelon.id,  300);
  await recipe('Pomegranate Juice',   pomegranate.id, 250);
  await recipe('Banana Milk',         banana.id,      2);
  await recipe('Banana Milk',         milk.id,        200);
  await recipe('Dates Milk',          dates.id,       80);
  await recipe('Dates Milk',          milk.id,        200);
  await recipe('Guava Milk',          guava.id,       150);
  await recipe('Guava Milk',          milk.id,        150);
  await recipe('Strawberry Milk Juice', strawberry.id, 150);
  await recipe('Strawberry Milk Juice', milk.id,       150);
  await recipe('Avocado Juice',       avocado.id,     1);
  await recipe('Avocado Juice',       milk.id,        200);

  // ── Frappe ───────────────────────────────────────────────────────────────────
  await recipe('Frappe Vanilla',    frappeMix.id,  40); await recipe('Frappe Vanilla',    vanilla.id,    30);  await recipe('Frappe Vanilla',    milk.id,       200);
  await recipe('Frappe Caramel',    frappeMix.id,  40); await recipe('Frappe Caramel',    caramel.id,    30);  await recipe('Frappe Caramel',    milk.id,       200);
  await recipe('Frappe Mocha',      frappeMix.id,  40); await recipe('Frappe Mocha',      mocha.id,      30);  await recipe('Frappe Mocha',      milk.id,       200);
  await recipe('Frappe Nutella',    frappeMix.id,  40); await recipe('Frappe Nutella',    nutella.id,    40);  await recipe('Frappe Nutella',    milk.id,       200);
  await recipe('Frappe Hazelnut',   frappeMix.id,  40); await recipe('Frappe Hazelnut',   hazelnut.id,   30);  await recipe('Frappe Hazelnut',   milk.id,       200);
  await recipe('Frappe Lotus',      frappeMix.id,  40); await recipe('Frappe Lotus',      lotus.id,      40);  await recipe('Frappe Lotus',      milk.id,       200);
  await recipe('Frappe Pistachio',  frappeMix.id,  40); await recipe('Frappe Pistachio',  pistachio.id,  40);  await recipe('Frappe Pistachio',  milk.id,       200);
  await recipe('Frappuchino Classic', frappeMix.id, 40); await recipe('Frappuchino Classic', coffeeBeans.id, 18); await recipe('Frappuchino Classic', milk.id, 200);
  await recipe('Frappuchino Flavor',  frappeMix.id, 40); await recipe('Frappuchino Flavor',  caramel.id,  30); await recipe('Frappuchino Flavor',  milk.id, 200);

  // ── Cocktails ─────────────────────────────────────────────────────────────────
  await recipe('Blue Lemon Cocktail', lemon.id,        2);
  await recipe('Blue Lemon Cocktail', blueSyrup.id,    30);
  await recipe('Florida',             floridaBlend.id, 100);
  await recipe('Three Flowers',       flowerBlend.id,  100);
  await recipe('Mango Energy',        mango.id,        150);
  await recipe('Mango Energy',        passionFruit.id, 50);
  await recipe('Froment',             fromentBlend.id, 100);
  await recipe('Lemus',               lemusBlend.id,   100);

  // ── Waffles ───────────────────────────────────────────────────────────────────
  await recipe('Nutella Waffle',         waffleMix.id, 80); await recipe('Nutella Waffle',         nutella.id,   50);
  await recipe('Lotus Waffle',           waffleMix.id, 80); await recipe('Lotus Waffle',           lotus.id,     50);
  await recipe('Pistachio Waffle',       waffleMix.id, 80); await recipe('Pistachio Waffle',       pistachio.id, 50);
  await recipe('White Chocolate Waffle', waffleMix.id, 80); await recipe('White Chocolate Waffle', whitChoc.id,  50);
  await recipe('Waffle Mix Sauce',       waffleMix.id, 80); await recipe('Waffle Mix Sauce',       caramel.id,   20); await recipe('Waffle Mix Sauce', nutella.id, 20);

  // ── Yogurt Corner ─────────────────────────────────────────────────────────────
  await recipe('Honey Yogurt',  yogurtBase.id, 200); await recipe('Honey Yogurt',  honey.id,      30);
  await recipe('Flavor Yogurt', yogurtBase.id, 200);

  // ── Ice Cream ─────────────────────────────────────────────────────────────────
  await recipe('Ice Cream 2 Scoop', iceCream.id, 160);
  await recipe('Ice Cream 3 Scoop', iceCream.id, 240);
  await recipe('Ice Cream 4 Scoop', iceCream.id, 320);

  // ── Coffee (legacy seed items) ────────────────────────────────────────────────
  await recipe('Retro Espresso', coffeeBeans.id, 18);
  await recipe('Vinyl Latte',    coffeeBeans.id, 18);
  await recipe('Vinyl Latte',    milk.id,        200);

  console.log('✅ Inventory seeded successfully!');
  const ingCount    = await prisma.ingredient.count();
  const recipeCount = await prisma.recipe.count();
  console.log(`   📦 ${ingCount} ingredients`);
  console.log(`   📋 ${recipeCount} recipe entries`);
}

async function ing(
  nameEn: string, nameAr: string, unit: string,
  quantityAvailable: number, lowStockThreshold: number,
) {
  return prisma.ingredient.create({
    data: { nameEn, nameAr, unit, quantityAvailable, lowStockThreshold },
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
