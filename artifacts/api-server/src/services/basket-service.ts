import { eq } from "drizzle-orm";
import {
  db,
  basketsTable,
  basketItemsTable,
  productsTable,
  retailersTable,
  recipesTable,
  recipeIngredientsTable,
} from "@workspace/db";
import {
  basketQuantityForIngredient,
  ingredientAmountInPackUnit,
  productPackGrams,
  scoreProductForIngredient,
} from "./ingredient-matching";

const TARGET_RETAILERS = ["Woolworths Food", "Pick n Pay", "Checkers"];

async function getRetailerName(id: number): Promise<string> {
  const r = await db.select().from(retailersTable).where(eq(retailersTable.id, id)).limit(1);
  return r[0]?.name ?? "Unknown";
}

function buildProductPageUrl(productName: string, retailerName: string) {
  const query = encodeURIComponent(productName);
  if (/woolworths/i.test(retailerName)) {
    return `https://www.woolworths.co.za/cat?Ntt=${query}`;
  }
  if (/pick\s*n\s*pay|pnp/i.test(retailerName)) {
    return `https://www.pnp.co.za/pnpstorefront/pnp/en/search/?text=${query}`;
  }
  if (/checkers/i.test(retailerName)) {
    return `https://www.checkers.co.za/search/all?q=${query}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${retailerName} ${productName}`)}`;
}

function realisticPackPrice(product: typeof productsTable.$inferSelect) {
  const name = product.name.toLowerCase();
  const packKg = Math.max(0.1, productPackGrams(product) / 1000);

  if (/chicken|breast|fillet/.test(name)) return Math.round(115 * packKg * 100) / 100;
  if (/beef|steak|mince/.test(name)) return Math.round(140 * packKg * 100) / 100;
  if (/fish|salmon|hake/.test(name)) return Math.round(130 * packKg * 100) / 100;
  if (/tuna/.test(name)) return Math.max(22, Math.round(120 * packKg * 100) / 100);
  if (/egg/.test(name)) return Math.max(35, product.packSize * 3.5);
  if (/rice/.test(name)) return Math.round(34 * packKg * 100) / 100;
  if (/oat|porridge/.test(name)) return Math.round(52 * packKg * 100) / 100;
  if (/broccoli/.test(name)) return Math.round(65 * packKg * 100) / 100;
  if (/milk/.test(name)) return Math.round(22 * Math.max(1, product.packSize) * 100) / 100;
  if (/yoghurt|yogurt/.test(name)) return Math.round(58 * packKg * 100) / 100;
  if (/peanut butter/.test(name)) return Math.round(110 * packKg * 100) / 100;

  const perKgByCategory: Record<string, number> = {
    protein: 105,
    dairy: 55,
    grains: 42,
    fruit_veg: 55,
    snacks: 95,
    drinks: 24,
    condiments: 90,
    frozen: 85,
    pantry: 50,
    other: 50,
  };
  return Math.round((perKgByCategory[product.category] ?? perKgByCategory.other) * packKg * 100) / 100;
}

export function effectiveBasketPrice(product: typeof productsTable.$inferSelect) {
  const realistic = realisticPackPrice(product);
  if (product.priceAud >= realistic * 0.55) {
    return { price: product.priceAud, isEstimated: false };
  }
  return { price: realistic, isEstimated: true };
}

function basketQuantityForEquivalentProduct(
  sourceQuantity: number,
  sourceProduct: typeof productsTable.$inferSelect,
  targetProduct: typeof productsTable.$inferSelect,
) {
  const sourcePackUnit = sourceProduct.packUnit;
  if (sourcePackUnit === targetProduct.packUnit) {
    const needed = sourceQuantity * sourceProduct.packSize;
    return Math.max(1, Math.ceil(needed / Math.max(targetProduct.packSize, 0.001)));
  }

  const sourceGrams = sourceQuantity * productPackGrams(sourceProduct);
  if (targetProduct.packUnit === "kg") return Math.max(1, Math.ceil(sourceGrams / 1000 / Math.max(targetProduct.packSize, 0.001)));
  if (targetProduct.packUnit === "g") return Math.max(1, Math.ceil(sourceGrams / Math.max(targetProduct.packSize, 0.001)));
  if (targetProduct.packUnit === "l") return Math.max(1, Math.ceil(sourceGrams / 1000 / Math.max(targetProduct.packSize, 0.001)));
  if (targetProduct.packUnit === "ml") return Math.max(1, Math.ceil(sourceGrams / Math.max(targetProduct.packSize, 0.001)));
  return Math.max(1, Math.ceil(sourceQuantity));
}

async function getTargetRetailers() {
  const retailers = await db.select().from(retailersTable).where(eq(retailersTable.marketCode, "ZA"));
  return retailers.filter((retailer) => TARGET_RETAILERS.some((name) => name.toLowerCase() === retailer.name.toLowerCase()));
}

async function findBestProductForRetailer(
  ingredient: typeof recipeIngredientsTable.$inferSelect,
  retailerId: number,
  products: Array<typeof productsTable.$inferSelect>,
) {
  const ranked = products
    .filter((product) => product.retailerId === retailerId)
    .map((product) => ({ product, score: scoreProductForIngredient(ingredient.name, product) }))
    .filter((item) => item.score >= 3)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aQty = basketQuantityForIngredient(ingredient, a.product);
      const bQty = basketQuantityForIngredient(ingredient, b.product);
      return effectiveBasketPrice(a.product).price * aQty - effectiveBasketPrice(b.product).price * bQty;
    });
  return ranked[0]?.product ?? null;
}

async function buildStoreComparisons(items: NonNullable<Awaited<ReturnType<typeof buildBasketItemResponse>>>[]) {
  const [retailers, products] = await Promise.all([
    getTargetRetailers(),
    db.select().from(productsTable),
  ]);
  const productMap = new Map<number, typeof productsTable.$inferSelect>();
  for (const product of products) productMap.set(product.id, product);

  return retailers.map((retailer) => {
    const comparisonItems = items.map((item) => {
      const sourceProduct = productMap.get(item.productId);
      if (!sourceProduct) return null;
      const ranked = products
        .filter((product) => product.retailerId === retailer.id && product.category === sourceProduct.category)
        .map((product) => ({ product, score: scoreProductForIngredient(sourceProduct.name, product) }))
        .filter((candidate) => candidate.score >= 3)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const aQty = basketQuantityForEquivalentProduct(item.quantity, sourceProduct, a.product);
          const bQty = basketQuantityForEquivalentProduct(item.quantity, sourceProduct, b.product);
          return effectiveBasketPrice(a.product).price * aQty - effectiveBasketPrice(b.product).price * bQty;
        });
      const match = ranked[0]?.product;
      if (!match) return null;
      const quantity = basketQuantityForEquivalentProduct(item.quantity, sourceProduct, match);
      const effectivePrice = effectiveBasketPrice(match);
      return {
        sourceProductId: item.productId,
        productId: match.id,
        productName: match.name,
        productUrl: buildProductPageUrl(match.name, retailer.name),
        quantity,
        packSize: match.packSize,
        packUnit: match.packUnit,
        unitCost: effectivePrice.price,
        priceIsEstimated: effectivePrice.isEstimated,
        totalCost: Math.round(effectivePrice.price * quantity * 100) / 100,
      };
    }).filter(Boolean);

    const totalCost = comparisonItems.reduce((sum, item) => sum + (item?.totalCost ?? 0), 0);
    return {
      retailerId: retailer.id,
      retailerName: retailer.name,
      matchedItems: comparisonItems.length,
      totalItems: items.length,
      totalCost: Math.round(totalCost * 100) / 100,
      items: comparisonItems,
    };
  }).sort((a, b) => a.totalCost - b.totalCost);
}

export async function buildBasketItemResponse(item: typeof basketItemsTable.$inferSelect) {
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, item.productId))
    .limit(1);
  const product = products[0];
  if (!product) return null;

  const retailerName = await getRetailerName(product.retailerId);
  const effectivePrice = effectiveBasketPrice(product);

  return {
    id: item.id,
    basketId: item.basketId,
    productId: item.productId,
    productName: product.name,
    retailerName,
    productUrl: buildProductPageUrl(product.name, retailerName),
    quantity: item.quantity,
    unit: item.unit,
    unitCost: effectivePrice.price,
    listedUnitCost: product.priceAud,
    priceIsEstimated: effectivePrice.isEstimated,
    totalCost: Math.round(effectivePrice.price * item.quantity * 100) / 100,
    packSize: product.packSize,
    packUnit: product.packUnit,
    isOnSpecial: product.isOnSpecial,
    category: product.category,
    isSubstitute: item.isSubstitute,
    isEssential: item.isEssential,
  };
}

export async function buildBasketDetail(id: number) {
  const baskets = await db.select().from(basketsTable).where(eq(basketsTable.id, id)).limit(1);
  if (baskets.length === 0) return null;
  const basket = baskets[0];

  const rawItems = await db
    .select()
    .from(basketItemsTable)
    .where(eq(basketItemsTable.basketId, id));

  const itemResults = await Promise.all(rawItems.map(buildBasketItemResponse));
  const items = itemResults.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof buildBasketItemResponse>>>[];

  // Fetch product nutrition for totals
  const productIds = [...new Set(rawItems.map((i) => i.productId))];
  const productMap = new Map<number, typeof productsTable.$inferSelect>();
  for (const pid of productIds) {
    const p = await db.select().from(productsTable).where(eq(productsTable.id, pid)).limit(1);
    if (p[0]) productMap.set(pid, p[0]);
  }

  let totalCost = 0;
  let totalCalories = 0;
  let totalProteinG = 0;
  let totalCarbsG = 0;
  let totalFatG = 0;
  let savingsFromSpecials = 0;

  for (const item of items) {
    totalCost += item.totalCost;
    const product = productMap.get(item.productId);
    if (product) {
      const servingG = item.quantity * productPackGrams(product);
      totalCalories += Math.round((product.caloriesPer100g * servingG) / 100);
      totalProteinG += (product.proteinPer100g * servingG) / 100;
      totalCarbsG += (product.carbsPer100g * servingG) / 100;
      totalFatG += (product.fatPer100g * servingG) / 100;
      const effectivePrice = effectiveBasketPrice(product);
      if (product.isOnSpecial && product.regularPriceAud) {
        savingsFromSpecials += (product.regularPriceAud - effectivePrice.price) * item.quantity;
      }
    }
  }

  const totalServings = Math.max(1, Math.round(totalCalories / 600));

  return {
    id: basket.id,
    name: basket.name,
    mode: basket.mode,
    items,
    storeComparisons: await buildStoreComparisons(items),
    totalCost: Math.round(totalCost * 100) / 100,
    totalCalories,
    totalProteinG: Math.round(totalProteinG * 10) / 10,
    totalCarbsG: Math.round(totalCarbsG * 10) / 10,
    totalFatG: Math.round(totalFatG * 10) / 10,
    totalServings,
    costPerServing: totalServings > 0 ? Math.round((totalCost / totalServings) * 100) / 100 : 0,
    savingsFromSpecials: Math.round(savingsFromSpecials * 100) / 100,
    createdAt: basket.createdAt.toISOString(),
  };
}

export async function createBasketFromRecipes(input: { recipeIds: number[]; name?: string; mode?: string }) {
  const { recipeIds, name, mode } = input;
  const [basket] = await db.insert(basketsTable).values({ name: name ?? "Recipe Basket", mode: mode ?? "cheapest" }).returning();
  const ingredientMap = new Map<number, { productId: number; needed: number; product: typeof productsTable.$inferSelect }>();
  const [targetRetailers, products] = await Promise.all([getTargetRetailers(), db.select().from(productsTable)]);

  for (const recipeId of recipeIds) {
    const ingredients = await db.select().from(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, recipeId));
    for (const ingredient of ingredients) {
      const matchedProducts = await Promise.all(targetRetailers.map((retailer) => findBestProductForRetailer(ingredient, retailer.id, products)));
      const fallbackProduct = ingredient.productId ? products.find((product) => product.id === ingredient.productId) ?? null : null;
      const product = [...matchedProducts, fallbackProduct]
        .filter((candidate): candidate is typeof productsTable.$inferSelect => Boolean(candidate))
        .map((candidate) => ({ product: candidate, quantity: basketQuantityForIngredient(ingredient, candidate) }))
        .sort((a, b) => effectiveBasketPrice(a.product).price * a.quantity - effectiveBasketPrice(b.product).price * b.quantity)[0]?.product;
      if (!product) continue;

      const needed = ingredientAmountInPackUnit(ingredient, product);
      const existing = ingredientMap.get(product.id);
      if (existing) existing.needed += needed;
      else ingredientMap.set(product.id, { productId: product.id, needed, product });
    }
  }

  for (const item of ingredientMap.values()) {
    const quantity = Math.max(1, Math.ceil(item.needed / Math.max(item.product.packSize, 0.001)));
    await db.insert(basketItemsTable).values({ basketId: basket.id, productId: item.productId, quantity, unit: "pack" });
  }
  return buildBasketDetail(basket.id);
}
