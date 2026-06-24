import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { db, recipesTable, recipeIngredientsTable, savedRecipesTable, userProfileTable, mealEntriesTable, activityLogsTable } from "@workspace/db";
import {
  GetRecipeParams,
  ListRecipesQueryParams,
} from "@workspace/api-zod";
import { calcGoalMetrics } from "./profile";
import { DEFAULT_NUTRITION_TARGETS, roundMoney, roundNutrition } from "@workspace/nutrition";
import { parseId } from "../lib/request";

const router: IRouter = Router();

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch_dinner: "Lunch/Dinner",
  snack: "Snack",
};

const PLAN_SLOTS = [
  { key: "breakfast", label: "Breakfast", mealType: "breakfast", calorieShare: 0.25, proteinShare: 0.25 },
  { key: "lunch", label: "Lunch", mealType: "lunch_dinner", calorieShare: 0.35, proteinShare: 0.35 },
  { key: "dinner", label: "Dinner", mealType: "lunch_dinner", calorieShare: 0.3, proteinShare: 0.3 },
  { key: "snack", label: "Snack", mealType: "snack", calorieShare: 0.1, proteinShare: 0.1 },
] as const;

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

type RecipeResponse = Awaited<ReturnType<typeof buildRecipeResponse>>;
type MealPlanRecipe = RecipeResponse & { mealType: string; mealTypeLabel: string };
type MealPlanItem = { slot: string; slotLabel: string; explanation: string; recipe: MealPlanRecipe };
type MealPlanDay = {
  day: number;
  label: string;
  items: MealPlanItem[];
  totals: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    cost: number;
    householdCost: number;
    budgetRemaining: number | null;
    calorieTarget: number;
    proteinTargetG: number;
    calorieCoveragePercent: number;
    proteinCoveragePercent: number;
  };
};

function scorePlanRecipe(
  recipe: typeof recipesTable.$inferSelect,
  targetCalories: number,
  targetProtein: number,
  savedIds: Set<number>,
  usedCounts: Map<number, number>,
) {
  const calorieGap = Math.abs(recipe.caloriesPerServing - targetCalories);
  const proteinShortfall = Math.max(0, targetProtein - recipe.proteinPerServingG) * 8;
  const repeatPenalty = (usedCounts.get(recipe.id) ?? 0) * 80;
  const savedBoost = savedIds.has(recipe.id) ? -40 : 0;
  const costPenalty = Math.max(0, recipe.estimatedCost - 75) * 0.25;
  return calorieGap + proteinShortfall + repeatPenalty + costPenalty + savedBoost;
}

function pickPlanRecipe(
  candidates: Array<typeof recipesTable.$inferSelect>,
  targetCalories: number,
  targetProtein: number,
  savedIds: Set<number>,
  usedCounts: Map<number, number>,
) {
  return [...candidates].sort(
    (a, b) =>
      scorePlanRecipe(a, targetCalories, targetProtein, savedIds, usedCounts) -
      scorePlanRecipe(b, targetCalories, targetProtein, savedIds, usedCounts),
  )[0];
}

function parseCsv(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function explainGoalToCartChoice(
  recipe: typeof recipesTable.$inferSelect,
  slot: (typeof PLAN_SLOTS)[number],
  pantryItems: string[],
  householdSize: number,
) {
  const cookTime = recipe.prepTimeMin + recipe.cookTimeMin;
  const pantryOverlap = pantryItems.filter((item) => normalizeToken(recipe.name).includes(normalizeToken(item)));
  const wasteNote = pantryOverlap.length > 0
    ? `uses pantry item ${pantryOverlap[0]} to reduce waste`
    : "keeps ingredients reusable across the weekly basket";

  return [
    `${slot.label}: balances ${recipe.proteinPerServingG}g protein with ${recipe.caloriesPerServing} kcal.`,
    `Cost trade-off: about ${roundMoney(recipe.estimatedCost * householdSize)} for ${householdSize} household member${householdSize === 1 ? "" : "s"}.`,
    `Time trade-off: ${cookTime} minutes prep/cook.`,
    `Waste trade-off: ${wasteNote}.`,
  ].join(" ");
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

router.get("/recipes/meal-plan", async (req, res): Promise<void> => {
  const requestedDays = parseInt(String(req.query.days ?? "7"), 10);
  const days = Number.isFinite(requestedDays) ? Math.min(14, Math.max(1, requestedDays)) : 7;
  const requestedHouseholdSize = parseInt(String(req.query.householdSize ?? "1"), 10);
  const householdSize = Number.isFinite(requestedHouseholdSize) ? Math.min(12, Math.max(1, requestedHouseholdSize)) : 1;
  const requestedMaxCookingTime = parseInt(String(req.query.maxCookingTime ?? "90"), 10);
  const maxCookingTime = Number.isFinite(requestedMaxCookingTime) ? Math.min(240, Math.max(5, requestedMaxCookingTime)) : 90;
  const budgetWeekly = Number.parseFloat(String(req.query.budgetWeekly ?? "0"));
  const dietaryRules = parseCsv(req.query.dietaryRules);
  const pantryItems = parseCsv(req.query.pantryItems);
  const preferredRetailers = parseCsv(req.query.preferredRetailers);
  const savedIds = await getSavedRecipeIds();
  const profiles = await db.select().from(userProfileTable).limit(1);
  const metrics = profiles[0] ? calcGoalMetrics(profiles[0]) : null;
  const calorieTarget = metrics?.dailyCalorieTarget ?? DEFAULT_NUTRITION_TARGETS.calories;
  const proteinTargetG = metrics?.proteinTargetG ?? DEFAULT_NUTRITION_TARGETS.proteinG;

  let recipes = await db.select().from(recipesTable);
  recipes = recipes.filter((recipe) => {
    if (recipe.prepTimeMin + recipe.cookTimeMin > maxCookingTime) return false;
    if (dietaryRules.length > 0 && !dietaryRules.every((rule) => recipe.tags.includes(normalizeToken(rule).replace(/\s+/g, "_")))) return false;
    return true;
  });
  const enriched = await Promise.all(
    recipes.map(async (recipe) => {
      const ingredients = await db.select().from(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, recipe.id));
      return { recipe, mealType: inferMealType(recipe, ingredients) };
    }),
  );

  const usedCounts = new Map<number, number>();
  const dayPlans: MealPlanDay[] = [];
  for (let day = 0; day < days; day++) {
    const items: MealPlanItem[] = [];
    for (const slot of PLAN_SLOTS) {
      const preferred = enriched.filter((item) => item.mealType === slot.mealType).map((item) => item.recipe);
      const fallback = enriched.map((item) => item.recipe);
      const recipe = pickPlanRecipe(
        preferred.length > 0 ? preferred : fallback,
        calorieTarget * slot.calorieShare,
        proteinTargetG * slot.proteinShare,
        savedIds,
        usedCounts,
      );
      if (!recipe) continue;
      usedCounts.set(recipe.id, (usedCounts.get(recipe.id) ?? 0) + 1);
      const mealType = enriched.find((item) => item.recipe.id === recipe.id)?.mealType ?? "lunch_dinner";
      items.push({
        slot: slot.key,
        slotLabel: slot.label,
        explanation: explainGoalToCartChoice(recipe, slot, pantryItems, householdSize),
        recipe: {
          ...(await buildRecipeResponse(recipe, savedIds)),
          mealType,
          mealTypeLabel: MEAL_TYPE_LABELS[mealType] ?? MEAL_TYPE_LABELS.lunch_dinner,
        },
      });
    }

    const totals = items.reduce(
      (sum, item) => ({
        calories: sum.calories + item.recipe.caloriesPerServing,
        proteinG: sum.proteinG + item.recipe.proteinPerServingG,
        carbsG: sum.carbsG + item.recipe.carbsPerServingG,
        fatG: sum.fatG + item.recipe.fatPerServingG,
        cost: sum.cost + item.recipe.estimatedCost,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, cost: 0 },
    );

    dayPlans.push({
      day: day + 1,
      label: day === 0 ? "Today" : `Day ${day + 1}`,
      items,
      totals: {
        calories: Math.round(totals.calories),
        proteinG: roundNutrition(totals.proteinG),
        carbsG: roundNutrition(totals.carbsG),
        fatG: roundNutrition(totals.fatG),
        cost: roundMoney(totals.cost),
        householdCost: roundMoney(totals.cost * householdSize),
        budgetRemaining: Number.isFinite(budgetWeekly) && budgetWeekly > 0 ? roundMoney((budgetWeekly / days) - (totals.cost * householdSize)) : null,
        calorieTarget,
        proteinTargetG,
        calorieCoveragePercent: Math.round((totals.calories / calorieTarget) * 100),
        proteinCoveragePercent: Math.round((totals.proteinG / proteinTargetG) * 100),
      },
    });
  }

  res.json({
    calorieTarget,
    proteinTargetG,
    householdSize,
    budgetWeekly: Number.isFinite(budgetWeekly) && budgetWeekly > 0 ? budgetWeekly : null,
    maxCookingTime,
    dietaryRules,
    pantryItems,
    preferredRetailers,
    days: dayPlans,
    savedRecipeCount: savedIds.size,
  });
});

router.get("/recipes/adaptive-replan", async (req, res): Promise<void> => {
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  const profiles = await db.select().from(userProfileTable).limit(1);
  const metrics = profiles[0] ? calcGoalMetrics(profiles[0]) : null;
  const calorieTarget = metrics?.dailyCalorieTarget ?? DEFAULT_NUTRITION_TARGETS.calories;
  const proteinTargetG = metrics?.proteinTargetG ?? DEFAULT_NUTRITION_TARGETS.proteinG;
  const [meals, activities, recipes] = await Promise.all([
    db.select().from(mealEntriesTable).where(eq(mealEntriesTable.date, date)),
    db.select().from(activityLogsTable).where(eq(activityLogsTable.date, date)),
    db.select().from(recipesTable),
  ]);
  const consumedCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
  const consumedProteinG = meals.reduce((sum, meal) => sum + meal.proteinG, 0);
  const activeCalories = activities.reduce((sum, activity) => sum + activity.activeCalories, 0);
  const remainingCalories = Math.max(0, calorieTarget + activeCalories - consumedCalories);
  const remainingProteinG = Math.max(0, proteinTargetG - consumedProteinG);
  const selectedRecipe = [...recipes].sort((a, b) => {
    const aScore = Math.abs(a.caloriesPerServing - remainingCalories * 0.45) + Math.max(0, remainingProteinG * 0.45 - a.proteinPerServingG) * 10 + a.estimatedCost * 0.2;
    const bScore = Math.abs(b.caloriesPerServing - remainingCalories * 0.45) + Math.max(0, remainingProteinG * 0.45 - b.proteinPerServingG) * 10 + b.estimatedCost * 0.2;
    return aScore - bScore;
  })[0];
  const ingredients = selectedRecipe ? await db.select().from(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, selectedRecipe.id)) : [];

  res.json({
    date,
    consumedCalories,
    consumedProteinG: roundNutrition(consumedProteinG),
    activeCalories,
    remainingCalories,
    remainingProteinG: roundNutrition(remainingProteinG),
    recommendation: selectedRecipe ? {
      id: selectedRecipe.id,
      name: selectedRecipe.name,
      caloriesPerServing: selectedRecipe.caloriesPerServing,
      proteinPerServingG: selectedRecipe.proteinPerServingG,
      estimatedCost: selectedRecipe.estimatedCost,
      reason: `Rebalances the day toward ${remainingCalories} kcal and ${roundNutrition(remainingProteinG)}g protein remaining after logged meals and workouts.`,
      substitutions: ingredients.flatMap((ingredient) => ingredient.substitutes.slice(0, 1).map((substitute) => ({
        ingredient: ingredient.name,
        substitute,
        reason: `Use ${substitute} if ${ingredient.name} is unavailable or too expensive; keeps the recipe role similar without changing the macro target materially.`,
      }))),
      leftovers: selectedRecipe.servings > 1 ? `Cook ${selectedRecipe.servings} servings and carry leftovers into tomorrow's lunch.` : null,
      wasteFlags: ingredients.filter((ingredient) => ingredient.quantity > 1).slice(0, 3).map((ingredient) => `${ingredient.name} may leave extra ${ingredient.unit}; plan another meal using it this week.`),
    } : null,
  });
});

router.get("/recipes/:id/related", async (req, res): Promise<void> => {
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
