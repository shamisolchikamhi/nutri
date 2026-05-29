import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { db, recipesTable, recipeIngredientsTable, savedRecipesTable, userProfileTable } from "@workspace/db";
import {
  GetRecipeParams,
  ListRecipesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function parseId(raw: unknown): number {
  return parseInt(Array.isArray(raw) ? raw[0] : String(raw), 10);
}

async function getSavedRecipeIds(): Promise<Set<number>> {
  const saved = await db.select().from(savedRecipesTable);
  return new Set(saved.map((s) => s.recipeId));
}

async function buildRecipeResponse(recipe: typeof recipesTable.$inferSelect, savedIds: Set<number>) {
  return {
    ...recipe,
    isSaved: savedIds.has(recipe.id),
  };
}

router.get("/recipes/recommended", async (req, res): Promise<void> => {
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

router.get("/recipes/:id", async (req, res): Promise<void> => {
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
    isSaved: savedIds.has(id),
    ingredients,
  });
});

export default router;
