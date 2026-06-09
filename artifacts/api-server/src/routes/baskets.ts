import { Router, type IRouter } from "express";
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
  CreateBasketBody,
  GetBasketParams,
  UpdateBasketParams,
  UpdateBasketBody,
  DeleteBasketParams,
  AddBasketItemParams,
  AddBasketItemBody,
  UpdateBasketItemParams,
  UpdateBasketItemBody,
  DeleteBasketItemParams,
  CreateBasketFromRecipesBody,
  GetShoppingListParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const TARGET_RETAILERS = ["Woolworths Food", "Pick n Pay", "Checkers"];

function parseId(raw: unknown): number {
  return parseInt(Array.isArray(raw) ? raw[0] : String(raw), 10);
}

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

function normalizeTokens(value: string) {
  const stop = new Set(["fresh", "free", "range", "skinless", "boneless", "smooth", "organic", "woolworths", "pnp", "checkers"]);
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stop.has(token));
}

function productPackGrams(product: typeof productsTable.$inferSelect) {
  if (product.packUnit === "kg") return product.packSize * 1000;
  if (product.packUnit === "g") return product.packSize;
  if (product.packUnit === "l") return product.packSize * 1000;
  if (product.packUnit === "ml") return product.packSize;
  return Math.max(1, product.packSize) * 100;
}

function ingredientAmountInPackUnit(ingredient: typeof recipeIngredientsTable.$inferSelect, product: typeof productsTable.$inferSelect) {
  if ((ingredient.unit === "g" || ingredient.unit === "kg") && product.packUnit === "kg") {
    return ingredient.unit === "kg" ? ingredient.quantity : ingredient.quantity / 1000;
  }
  if ((ingredient.unit === "g" || ingredient.unit === "kg") && product.packUnit === "g") {
    return ingredient.unit === "kg" ? ingredient.quantity * 1000 : ingredient.quantity;
  }
  if ((ingredient.unit === "ml" || ingredient.unit === "l") && product.packUnit === "l") {
    return ingredient.unit === "l" ? ingredient.quantity : ingredient.quantity / 1000;
  }
  if ((ingredient.unit === "ml" || ingredient.unit === "l") && product.packUnit === "ml") {
    return ingredient.unit === "l" ? ingredient.quantity * 1000 : ingredient.quantity;
  }
  if (ingredient.unit === "unit") return ingredient.quantity;
  return ingredient.quantity;
}

function scoreProductForIngredient(ingredientName: string, product: typeof productsTable.$inferSelect) {
  const ingredientTokens = normalizeTokens(ingredientName);
  const productTokens = normalizeTokens(`${product.brand ?? ""} ${product.name}`);
  const productSet = new Set(productTokens);
  let score = 0;
  for (const token of ingredientTokens) {
    if (productSet.has(token)) score += 5;
    else if (productTokens.some((candidate) => candidate.includes(token) || token.includes(candidate))) score += 2;
  }
  if (product.name.toLowerCase().includes(ingredientName.toLowerCase())) score += 6;
  if (product.category !== "other") score += 1;
  return score;
}

function basketQuantityForIngredient(ingredient: typeof recipeIngredientsTable.$inferSelect, product: typeof productsTable.$inferSelect) {
  const needed = ingredientAmountInPackUnit(ingredient, product);
  return Math.max(1, Math.ceil(needed / Math.max(product.packSize, 0.001)));
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
      return a.product.priceAud * aQty - b.product.priceAud * bQty;
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
          return a.product.priceAud * aQty - b.product.priceAud * bQty;
        });
      const match = ranked[0]?.product;
      if (!match) return null;
      const quantity = basketQuantityForEquivalentProduct(item.quantity, sourceProduct, match);
      return {
        sourceProductId: item.productId,
        productId: match.id,
        productName: match.name,
        productUrl: buildProductPageUrl(match.name, retailer.name),
        quantity,
        packSize: match.packSize,
        packUnit: match.packUnit,
        totalCost: Math.round(match.priceAud * quantity * 100) / 100,
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

async function buildBasketItemResponse(item: typeof basketItemsTable.$inferSelect) {
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, item.productId))
    .limit(1);
  const product = products[0];
  if (!product) return null;

  const retailerName = await getRetailerName(product.retailerId);

  return {
    id: item.id,
    basketId: item.basketId,
    productId: item.productId,
    productName: product.name,
    retailerName,
    productUrl: buildProductPageUrl(product.name, retailerName),
    quantity: item.quantity,
    unit: item.unit,
    unitCost: product.priceAud,
    totalCost: Math.round(product.priceAud * item.quantity * 100) / 100,
    packSize: product.packSize,
    packUnit: product.packUnit,
    isOnSpecial: product.isOnSpecial,
    category: product.category,
    isSubstitute: item.isSubstitute,
    isEssential: item.isEssential,
  };
}

async function buildBasketDetail(id: number) {
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
      if (product.isOnSpecial && product.regularPriceAud) {
        savingsFromSpecials += (product.regularPriceAud - product.priceAud) * item.quantity;
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

router.get("/baskets", async (_req, res): Promise<void> => {
  const baskets = await db.select().from(basketsTable);
  const result = await Promise.all(
    baskets.map(async (b) => {
      const items = await db
        .select()
        .from(basketItemsTable)
        .where(eq(basketItemsTable.basketId, b.id));
      const totalCost = await Promise.all(
        items.map(async (item) => {
          const p = await db
            .select()
            .from(productsTable)
            .where(eq(productsTable.id, item.productId))
            .limit(1);
          return p[0] ? p[0].priceAud * item.quantity : 0;
        })
      );
      return {
        id: b.id,
        name: b.name,
        mode: b.mode,
        itemCount: items.length,
        totalCost: Math.round(totalCost.reduce((s, c) => s + c, 0) * 100) / 100,
        totalServings: Math.max(1, items.length * 2),
        createdAt: b.createdAt.toISOString(),
      };
    })
  );
  res.json(result);
});

router.post("/baskets", async (req, res): Promise<void> => {
  const parsed = CreateBasketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [basket] = await db.insert(basketsTable).values(parsed.data).returning();
  res.status(201).json({
    id: basket.id,
    name: basket.name,
    mode: basket.mode,
    itemCount: 0,
    totalCost: 0,
    totalServings: 0,
    createdAt: basket.createdAt.toISOString(),
  });
});

router.get("/baskets/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const detail = await buildBasketDetail(id);
  if (!detail) {
    res.status(404).json({ error: "Basket not found" });
    return;
  }
  res.json(detail);
});

router.put("/baskets/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const parsed = UpdateBasketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [basket] = await db
    .update(basketsTable)
    .set(parsed.data)
    .where(eq(basketsTable.id, id))
    .returning();

  if (!basket) {
    res.status(404).json({ error: "Basket not found" });
    return;
  }

  const items = await db
    .select()
    .from(basketItemsTable)
    .where(eq(basketItemsTable.basketId, id));

  res.json({
    id: basket.id,
    name: basket.name,
    mode: basket.mode,
    itemCount: items.length,
    totalCost: 0,
    totalServings: 0,
    createdAt: basket.createdAt.toISOString(),
  });
});

router.delete("/baskets/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(basketItemsTable).where(eq(basketItemsTable.basketId, id));
  await db.delete(basketsTable).where(eq(basketsTable.id, id));
  res.sendStatus(204);
});

router.post("/baskets/:id/items", async (req, res): Promise<void> => {
  const basketId = parseId(req.params.id);
  const parsed = AddBasketItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db
    .insert(basketItemsTable)
    .values({ ...parsed.data, basketId })
    .returning();

  const built = await buildBasketItemResponse(item);
  res.status(201).json(built);
});

router.put("/baskets/:id/items/:itemId", async (req, res): Promise<void> => {
  const itemId = parseId(req.params.itemId);
  const parsed = UpdateBasketItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db
    .update(basketItemsTable)
    .set(parsed.data)
    .where(eq(basketItemsTable.id, itemId))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const built = await buildBasketItemResponse(item);
  res.json(built);
});

router.delete("/baskets/:id/items/:itemId", async (req, res): Promise<void> => {
  const itemId = parseId(req.params.itemId);
  await db.delete(basketItemsTable).where(eq(basketItemsTable.id, itemId));
  res.sendStatus(204);
});

router.post("/baskets/from-recipes", async (req, res): Promise<void> => {
  const parsed = CreateBasketFromRecipesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { recipeIds, name, mode } = parsed.data;

  const [basket] = await db
    .insert(basketsTable)
    .values({ name: name ?? "Recipe Basket", mode: mode ?? "cheapest" })
    .returning();

  // Gather all ingredients from all recipes, match them to available shop packs, and buy whole packs.
  const ingredientMap = new Map<number, { productId: number; needed: number; product: typeof productsTable.$inferSelect }>();
  const [targetRetailers, products] = await Promise.all([
    getTargetRetailers(),
    db.select().from(productsTable),
  ]);

  for (const recipeId of recipeIds) {
    const ingredients = await db
      .select()
      .from(recipeIngredientsTable)
      .where(eq(recipeIngredientsTable.recipeId, recipeId));

    for (const ing of ingredients) {
      const matchedProducts = await Promise.all(
        targetRetailers.map((retailer) => findBestProductForRetailer(ing, retailer.id, products)),
      );
      const fallbackProduct = ing.productId ? products.find((product) => product.id === ing.productId) ?? null : null;
      const product = [...matchedProducts, fallbackProduct]
        .filter((candidate): candidate is typeof productsTable.$inferSelect => Boolean(candidate))
        .map((candidate) => ({
          product: candidate,
          quantity: basketQuantityForIngredient(ing, candidate),
        }))
        .sort((a, b) => a.product.priceAud * a.quantity - b.product.priceAud * b.quantity)[0]?.product;
      if (!product) continue;

      const needed = ingredientAmountInPackUnit(ing, product);
      const existing = ingredientMap.get(product.id);
      if (existing) {
        existing.needed += needed;
      } else {
        ingredientMap.set(product.id, {
          productId: product.id,
          needed,
          product,
        });
      }
    }
  }

  for (const item of ingredientMap.values()) {
    const quantity = Math.max(1, Math.ceil(item.needed / Math.max(item.product.packSize, 0.001)));
    await db.insert(basketItemsTable).values({ basketId: basket.id, productId: item.productId, quantity, unit: "pack" });
  }

  const detail = await buildBasketDetail(basket.id);
  res.status(201).json(detail);
});

router.get("/baskets/:id/shopping-list", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const detail = await buildBasketDetail(id);
  if (!detail) {
    res.status(404).json({ error: "Basket not found" });
    return;
  }

  // Group by category
  const categoryGroups = new Map<string, typeof detail.items>();
  for (const item of detail.items) {
    const existing = categoryGroups.get(item.category) ?? [];
    existing.push(item);
    categoryGroups.set(item.category, existing);
  }

  const groups = Array.from(categoryGroups.entries()).map(([category, items]) => ({
    groupType: "category",
    groupLabel: category.replace(/_/g, " "),
    items,
  }));

  res.json({
    basketId: id,
    groups,
    totalCost: detail.totalCost,
    savingsFromSpecials: detail.savingsFromSpecials,
  });
});

export default router;
