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

function parseId(raw: unknown): number {
  return parseInt(Array.isArray(raw) ? raw[0] : String(raw), 10);
}

async function getRetailerName(id: number): Promise<string> {
  const r = await db.select().from(retailersTable).where(eq(retailersTable.id, id)).limit(1);
  return r[0]?.name ?? "Unknown";
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
    quantity: item.quantity,
    unit: item.unit,
    unitCost: product.priceAud,
    totalCost: Math.round(product.priceAud * item.quantity * 100) / 100,
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
      const servingG = (item.quantity * product.packSize * 100);
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

  // Gather all ingredients from all recipes, deduplicate by productId
  const ingredientMap = new Map<number, { productId: number; quantity: number; unit: string }>();
  for (const recipeId of recipeIds) {
    const ingredients = await db
      .select()
      .from(recipeIngredientsTable)
      .where(eq(recipeIngredientsTable.recipeId, recipeId));

    for (const ing of ingredients) {
      if (ing.productId) {
        const existing = ingredientMap.get(ing.productId);
        if (existing) {
          existing.quantity += ing.quantity;
        } else {
          ingredientMap.set(ing.productId, {
            productId: ing.productId,
            quantity: ing.quantity,
            unit: ing.unit,
          });
        }
      }
    }
  }

  for (const item of ingredientMap.values()) {
    await db.insert(basketItemsTable).values({ basketId: basket.id, ...item });
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
