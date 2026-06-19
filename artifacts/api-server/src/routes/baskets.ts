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
import { buildBasketDetail, buildBasketItemResponse, createBasketFromRecipes, effectiveBasketPrice } from "../services/basket-service";
import { parseId } from "../lib/request";

const router: IRouter = Router();

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
          return p[0] ? effectiveBasketPrice(p[0]).price * item.quantity : 0;
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

  const detail = await createBasketFromRecipes(parsed.data);
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
