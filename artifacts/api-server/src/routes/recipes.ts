import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { db, recipesTable, recipeIngredientsTable, savedRecipesTable, userProfileTable } from "@workspace/db";
import {
  GetRecipeParams,
  ListRecipesQueryParams,
} from "@workspace/api-zod";

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

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch_dinner: "Lunch/Dinner",
  snack: "Snack",
};

function inferMealType(recipe: typeof recipesTable.$inferSelect, ingredients: Array<typeof recipeIngredientsTable.$inferSelect> = []) {
  const text = normalizeToken(`${recipe.name} ${(recipe.tags ?? []).join(" ")} ${ingredients.map((item) => item.name).join(" ")}`);
  if (/\b(oats?|porridge|breakfast|granola|pancakes?|smoothie|yogh?urt|toast|eggs?)\b/.test(text)) return "breakfast";
  if (/\b(snack|bar|balls?|bites?|nuts?|fruit|chips?|dip|hummus)\b/.test(text)) return "snack";
  return recipe.mealType || "lunch_dinner";
}

function ingredientTokens(ingredients: Array<typeof recipeIngredientsTable.$inferSelect>) {
  const stop = new Set(["fresh", "chopped", "diced", "sliced", "cooked", "raw", "large", "small", "medium", "unit", "grams"]);
  return new Set(
    ingredients
      .flatMap((ingredient) => normalizeToken(ingredient.name).split(/\s+/))
      .filter((token) => token.length > 2 && !stop.has(token)),
  );
}

async function getSavedRecipeIds(): Promise<Set<number>> {
  const saved = await db.select().from(savedRecipesTable);
  return new Set(saved.map((s) => s.recipeId));
}

async function buildRecipeResponse(recipe: typeof recipesTable.$inferSelect, savedIds: Set<number>) {
  const mealType = inferMealType(recipe);
  return {
    ...recipe,
    mealType,
    mealTypeLabel: MEAL_TYPE_LABELS[mealType] ?? MEAL_TYPE_LABELS.lunch_dinner,
    isSaved: savedIds.has(recipe.id),
  };
}

router.get("/recipes/recommended", async (req, res): Promise<void> => {
  await ensureRecipesSchema();
  const profiles = await db.select().from(userProfileTable).limit(1);
  const savedIds = await getSavedRecipeIds();

  let tagFilter: string | null = null;
  if (profiles.length > 0) {
    const diet = profiles[0].dietPreference;
    if (diet === "high_protein") tagFilter = "high_protein";
    else if (diet === "low_calorie") tagFilter = "low_calorie";
    else if (diet === "vegan") tagFilter = "vegan";
    else if (diet === "low_carb") tagFilter = "low_carb";
  }

  let recipes;
  if (tagFilter) {
    recipes = await db
      .select()
      .from(recipesTable)
      .where(sql`${recipesTable.tags} @> ARRAY[${tagFilter}]::text[]`)
      .limit(6);
  } else {
    recipes = await db.select().from(recipesTable).limit(6);
  }

  const result = await Promise.all(recipes.map((r) => buildRecipeResponse(r, savedIds)));
  res.json(result);
});

router.get("/recipes", async (req, res): Promise<void> => {
  await ensureRecipesSchema();
  const params = ListRecipesQueryParams.safeParse(req.query);
  const savedIds = await getSavedRecipeIds();

  let recipes = await db.select().from(recipesTable);

  if (params.success) {
    const { query, goal, maxPrepTime, difficulty, maxCaloriesPerServing, minProteinPerServing, maxCost } = params.data;
    recipes = recipes.filter((r) => {
      if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (goal && !r.tags.includes(goal)) return false;
      if (maxPrepTime && r.prepTimeMin > maxPrepTime) return false;
      if (difficulty && r.difficulty !== difficulty) return false;
      if (maxCaloriesPerServing && r.caloriesPerServing > maxCaloriesPerServing) return false;
      if (minProteinPerServing && r.proteinPerServingG < minProteinPerServing) return false;
      if (maxCost && r.estimatedCost > maxCost) return false;
      return true;
    });
  }

  const result = await Promise.all(recipes.map((r) => buildRecipeResponse(r, savedIds)));
  res.json(result);
});

router.get("/recipes/:id/related", async (req, res): Promise<void> => {
  await ensureRecipesSchema();
  const id = parseId(req.params.id);
  const savedIds = await getSavedRecipeIds();
  const baseIngredients = await db.select().from(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, id));
  const baseTokens = ingredientTokens(baseIngredients);
  if (baseTokens.size === 0) {
    res.json([]);
    return;
  }
  const baseRecipe = (await db.select().from(recipesTable).where(eq(recipesTable.id, id)).limit(1))[0];
  const baseMealType = baseRecipe ? inferMealType(baseRecipe, baseIngredients) : "lunch_dinner";

  const recipes = (await db.select().from(recipesTable)).filter((recipe) => recipe.id !== id);
  const scored = [];
  for (const recipe of recipes) {
    const ingredients = await db.select().from(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, recipe.id));
    const tokens = ingredientTokens(ingredients);
    const shared = [...tokens].filter((token) => baseTokens.has(token));
    if (shared.length === 0) continue;
    const score = shared.length * 3 + (savedIds.has(recipe.id) ? 4 : 0) + (inferMealType(recipe, ingredients) === baseMealType ? 1 : 0);
    scored.push({ recipe, shared, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const result = await Promise.all(scored.slice(0, 6).map(async (item) => ({
    ...(await buildRecipeResponse(item.recipe, savedIds)),
    sharedIngredients: item.shared.slice(0, 5),
    savedBoost: savedIds.has(item.recipe.id),
  })));
  res.json(result);
});

router.get("/recipes/:id", async (req, res): Promise<void> => {
  await ensureRecipesSchema();
  const id = parseId(req.params.id);
  const savedIds = await getSavedRecipeIds();

  const recipes = await db.select().from(recipesTable).where(eq(recipesTable.id, id)).limit(1);
  if (recipes.length === 0) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  const ingredients = await db
    .select()
    .from(recipeIngredientsTable)
    .where(eq(recipeIngredientsTable.recipeId, id));

  res.json({
    ...recipes[0],
    mealType: inferMealType(recipes[0], ingredients),
    mealTypeLabel: MEAL_TYPE_LABELS[inferMealType(recipes[0], ingredients)] ?? MEAL_TYPE_LABELS.lunch_dinner,
    isSaved: savedIds.has(id),
    ingredients,
  });
});

export default router;
