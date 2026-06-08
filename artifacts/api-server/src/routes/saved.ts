import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  savedRecipesTable,
  savedSnacksTable,
  recipesTable,
  productsTable,
  retailersTable,
  specialsTable,
} from "@workspace/db";
import { SaveRecipeBody, UnsaveRecipeParams, SaveSnackBody } from "@workspace/api-zod";

const router: IRouter = Router();

let recipesSchemaReady: Promise<void> | null = null;

function ensureRecipesSchema() {
  recipesSchemaReady ??= db.execute(sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS meal_type text NOT NULL DEFAULT 'lunch_dinner'`).then(
    () => undefined,
    (error) => {
      recipesSchemaReady = null;
      throw error;
    },
  );
  return recipesSchemaReady;
}

function parseId(raw: unknown): number {
  return parseInt(Array.isArray(raw) ? raw[0] : String(raw), 10);
}

router.get("/saved/recipes", async (_req, res): Promise<void> => {
  await ensureRecipesSchema();
  const saved = await db.select().from(savedRecipesTable);
  const savedIds = new Set(saved.map((s) => s.recipeId));

  const recipes = await Promise.all(
    saved.map(async (s) => {
      const r = await db
        .select()
        .from(recipesTable)
        .where(eq(recipesTable.id, s.recipeId))
        .limit(1);
      return r[0] ? { ...r[0], isSaved: true } : null;
    })
  );

  res.json(recipes.filter(Boolean));
});

router.post("/saved/recipes", async (req, res): Promise<void> => {
  const parsed = SaveRecipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(savedRecipesTable)
    .where(eq(savedRecipesTable.recipeId, parsed.data.itemId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(savedRecipesTable).values({ recipeId: parsed.data.itemId });
  }

  res.sendStatus(201);
});

router.delete("/saved/recipes/:recipeId", async (req, res): Promise<void> => {
  const recipeId = parseId(req.params.recipeId);
  await db.delete(savedRecipesTable).where(eq(savedRecipesTable.recipeId, recipeId));
  res.sendStatus(204);
});

router.get("/saved/snacks", async (_req, res): Promise<void> => {
  const saved = await db.select().from(savedSnacksTable);
  const specials = await db.select().from(specialsTable);
  const specialMap = new Map(specials.map((s) => [s.productId, s]));

  const result = await Promise.all(
    saved.map(async (s) => {
      const p = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, s.productId))
        .limit(1);
      const product = p[0];
      if (!product) return null;

      const retailers = await db
        .select()
        .from(retailersTable)
        .where(eq(retailersTable.id, product.retailerId))
        .limit(1);
      const special = specialMap.get(product.id);
      const servingG = 30;

      return {
        productId: product.id,
        name: product.name,
        retailerName: retailers[0]?.name ?? "Unknown",
        priceAud: product.priceAud,
        caloriesPerServing: Math.round((product.caloriesPer100g * servingG) / 100),
        proteinPerServingG: Math.round((product.proteinPer100g * servingG) / 100 * 10) / 10,
        sugarPerServingG: Math.round(((product.sugarPer100g ?? 0) * servingG) / 100 * 10) / 10,
        fatPerServingG: Math.round((product.fatPer100g * servingG) / 100 * 10) / 10,
        servingSize: servingG,
        servingUnit: "g",
        isOnSpecial: product.isOnSpecial,
        savingsPercent: special ? special.savingsPercent : null,
        imageUrl: product.imageUrl,
        isSaved: true,
      };
    })
  );

  res.json(result.filter(Boolean));
});

router.post("/saved/snacks", async (req, res): Promise<void> => {
  const parsed = SaveSnackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(savedSnacksTable)
    .where(eq(savedSnacksTable.productId, parsed.data.itemId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(savedSnacksTable).values({ productId: parsed.data.itemId });
  }

  res.sendStatus(201);
});

router.delete("/saved/snacks/:productId", async (req, res): Promise<void> => {
  const productId = parseId(req.params.productId);
  await db.delete(savedSnacksTable).where(eq(savedSnacksTable.productId, productId));
  res.sendStatus(204);
});

export default router;
