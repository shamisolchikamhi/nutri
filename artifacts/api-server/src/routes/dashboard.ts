import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  dailyLogsTable,
  mealEntriesTable,
  activityLogsTable,
  recipesTable,
  productsTable,
  retailersTable,
  savedSnacksTable,
  specialsTable,
  basketsTable,
  basketItemsTable,
  userProfileTable,
} from "@workspace/db";
import { calcGoalMetrics } from "./profile";
import { DEFAULT_NUTRITION_TARGETS, roundMoney, roundNutrition } from "@workspace/nutrition";

const router: IRouter = Router();

router.get("/dashboard/today", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];

  const [profiles, dailyLogs, meals, activityLogs] = await Promise.all([
    db.select().from(userProfileTable).limit(1),
    db.select().from(dailyLogsTable).where(eq(dailyLogsTable.date, today)).limit(1),
    db.select().from(mealEntriesTable).where(eq(mealEntriesTable.date, today)),
    db.select().from(activityLogsTable).where(eq(activityLogsTable.date, today)).limit(1),
  ]);

  const profile = profiles[0];
  const log = dailyLogs[0];
  const activity = activityLogs[0];

  let calorieTarget = DEFAULT_NUTRITION_TARGETS.calories;
  let proteinTarget = DEFAULT_NUTRITION_TARGETS.proteinG;
  let goalProgressPercent = 0;
  let currentWeightKg: number | null = null;

  if (profile) {
    const metrics = calcGoalMetrics(profile);
    calorieTarget = metrics.dailyCalorieTarget;
    proteinTarget = metrics.proteinTargetG;
    currentWeightKg = profile.currentWeightKg;

    const kgLost = Math.max(0, profile.currentWeightKg - (log?.weightKg ?? profile.currentWeightKg));
    const totalToLose = Math.abs(profile.currentWeightKg - profile.targetWeightKg);
    goalProgressPercent = totalToLose > 0 ? Math.min(100, (kgLost / totalToLose) * 100) : 0;
  }

  const caloriesEaten = meals.reduce((s, m) => s + m.calories, 0);
  const proteinEatenG = meals.reduce((s, m) => s + m.proteinG, 0);
  const carbsEatenG = meals.reduce((s, m) => s + m.carbsG, 0);
  const fatEatenG = meals.reduce((s, m) => s + m.fatG, 0);
  const activeCaloriesBurned = activity
    ? activity.activeCalories + Math.round(activity.workoutDurationMin * 6)
    : 0;

  // Basket cost from most recent basket
  const baskets = await db.select().from(basketsTable).orderBy(desc(basketsTable.createdAt)).limit(1);
  let basketCost: number | null = null;
  if (baskets.length > 0) {
    const items = await db
      .select()
      .from(basketItemsTable)
      .where(eq(basketItemsTable.basketId, baskets[0].id));
    let cost = 0;
    for (const item of items) {
      const p = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
      if (p[0]) cost += p[0].priceAud * item.quantity;
    }
    basketCost = roundMoney(cost);
  }

  // Savings from all active specials
  const specials = await db.select().from(specialsTable);
  const savingsFromSpecials = specials.reduce((s, sp) => s + sp.savingsAud, 0);

  // Streak
  let streak = 0;
  const todayDate = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const count = await db
      .select()
      .from(mealEntriesTable)
      .where(eq(mealEntriesTable.date, ds));
    if (count.length > 0) streak++;
    else if (i > 0) break;
  }

  res.json({
    date: today,
    caloriesEaten,
    caloriesRemaining: Math.max(0, calorieTarget - caloriesEaten),
    calorieTarget,
    proteinEatenG: roundNutrition(proteinEatenG),
    proteinRemainingG: Math.max(0, roundNutrition(proteinTarget - proteinEatenG)),
    proteinTargetG: proteinTarget,
    carbsEatenG: roundNutrition(carbsEatenG),
    fatEatenG: roundNutrition(fatEatenG),
    waterMl: log?.waterMl ?? 0,
    netCalorieBalance: calorieTarget - caloriesEaten + activeCaloriesBurned,
    activeCaloriesBurned,
    goalProgressPercent: roundNutrition(goalProgressPercent),
    basketCost,
    savingsFromSpecials: roundMoney(savingsFromSpecials),
    streak,
    currentWeightKg,
  });
});

router.get("/dashboard/snack-suggestions", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const meals = await db.select().from(mealEntriesTable).where(eq(mealEntriesTable.date, today));
  const caloriesEaten = meals.reduce((s, m) => s + m.calories, 0);

  const profiles = await db.select().from(userProfileTable).limit(1);
  const calorieTarget = profiles[0] ? calcGoalMetrics(profiles[0]).dailyCalorieTarget : DEFAULT_NUTRITION_TARGETS.calories;
  const remaining = calorieTarget - caloriesEaten;

  const snackProducts = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.category, "snacks"));

  const savedSnacks = await db.select().from(savedSnacksTable);
  const savedIds = new Set(savedSnacks.map((s) => s.productId));

  const specials = await db.select().from(specialsTable);
  const specialMap = new Map(specials.map((s) => [s.productId, s]));

  const suggestions = await Promise.all(
    snackProducts
      .filter((p) => {
        const caloriesPer100g = p.caloriesPer100g;
        const servingCals = Math.round((caloriesPer100g * 30) / 100);
        return servingCals <= remaining && servingCals > 0;
      })
      .slice(0, 8)
      .map(async (p) => {
        const retailers = await db
          .select()
          .from(retailersTable)
          .where(eq(retailersTable.id, p.retailerId))
          .limit(1);
        const special = specialMap.get(p.id);
        const servingG = 30;
        return {
          productId: p.id,
          name: p.name,
          retailerName: retailers[0]?.name ?? "Unknown",
          priceAud: p.priceAud,
          caloriesPerServing: Math.round((p.caloriesPer100g * servingG) / 100),
          proteinPerServingG: roundNutrition((p.proteinPer100g * servingG) / 100),
          sugarPerServingG: roundNutrition(((p.sugarPer100g ?? 0) * servingG) / 100),
          fatPerServingG: roundNutrition((p.fatPer100g * servingG) / 100),
          servingSize: servingG,
          servingUnit: "g",
          isOnSpecial: p.isOnSpecial,
          savingsPercent: special ? special.savingsPercent : null,
          imageUrl: p.imageUrl,
          isSaved: savedIds.has(p.id),
        };
      })
  );

  res.json(suggestions);
});

router.get("/dashboard/meal-suggestion", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const meals = await db.select().from(mealEntriesTable).where(eq(mealEntriesTable.date, today));
  const caloriesEaten = meals.reduce((s, m) => s + m.calories, 0);

  const profiles = await db.select().from(userProfileTable).limit(1);
  const calorieTarget = profiles[0] ? calcGoalMetrics(profiles[0]).dailyCalorieTarget : DEFAULT_NUTRITION_TARGETS.calories;
  const remaining = calorieTarget - caloriesEaten;

  const mealCount = meals.length;
  const expectedCalsPerMeal = calorieTarget / 3;

  // Find a recipe that fits remaining calories
  const allRecipes = await db.select().from(recipesTable);
  const suitable = allRecipes.filter(
    (r) => r.caloriesPerServing <= remaining && r.caloriesPerServing >= expectedCalsPerMeal * 0.5
  );

  const recipe = suitable[mealCount % Math.max(1, suitable.length)] ?? allRecipes[0];
  if (!recipe) {
    res.status(404).json({ error: "No recipes found" });
    return;
  }

  res.json({ ...recipe, isSaved: false });
});

router.get("/dashboard/weekly-review", async (_req, res): Promise<void> => {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 6);
  const fromIso = from.toISOString().slice(0, 10);
  const toIso = today.toISOString().slice(0, 10);

  const [logs, meals, activities, baskets] = await Promise.all([
    db.select().from(dailyLogsTable),
    db.select().from(mealEntriesTable),
    db.select().from(activityLogsTable),
    db.select().from(basketsTable).orderBy(desc(basketsTable.createdAt)).limit(3),
  ]);
  const weekLogs = logs.filter((log) => log.date >= fromIso && log.date <= toIso);
  const weekMeals = meals.filter((meal) => meal.date >= fromIso && meal.date <= toIso);
  const weekActivities = activities.filter((activity) => activity.date >= fromIso && activity.date <= toIso);
  const loggedDays = new Set(weekMeals.map((meal) => meal.date));
  const adherencePercent = Math.round((loggedDays.size / 7) * 100);
  const avgActiveCalories = weekActivities.length
    ? Math.round(weekActivities.reduce((sum, activity) => sum + activity.activeCalories + Math.round(activity.workoutDurationMin * 6), 0) / weekActivities.length)
    : 0;
  const weights = weekLogs.filter((log) => log.weightKg != null).map((log) => ({ date: log.date, weightKg: log.weightKg as number })).sort((a, b) => a.date.localeCompare(b.date));
  const weightTrendKg = weights.length >= 2 ? roundNutrition(weights[weights.length - 1].weightKg - weights[0].weightKg) : null;
  const preferredMeals = Object.entries(weekMeals.reduce<Record<string, number>>((counts, meal) => {
    counts[meal.name] = (counts[meal.name] ?? 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

  let spend = 0;
  for (const basket of baskets) {
    const items = await db.select().from(basketItemsTable).where(eq(basketItemsTable.basketId, basket.id));
    for (const item of items) {
      const product = (await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1))[0];
      if (product) spend += product.priceAud * item.quantity;
    }
  }

  const wasteFlags = preferredMeals.length === 0
    ? ["No repeated meals yet, so waste patterns are still unknown."]
    : ["Repeated meals can be batch-prepped; check fresh ingredients before buying duplicate packs."];
  const suggestions = [
    adherencePercent < 60 ? "Log one anchor meal daily before adding more tracking detail." : "Keep the current logging rhythm and review only the meals that missed your target.",
    spend > 0 ? "Before the next basket, swap one fresh bulk pack for a shelf-stable or frozen option if it will not be used twice." : "Create one basket this week so spend and waste trade-offs can be reviewed.",
  ];

  res.json({
    weekStart: fromIso,
    weekEnd: toIso,
    adherencePercent,
    spend: roundMoney(spend),
    wasteFlags,
    weightTrendKg,
    energy: avgActiveCalories > 0 ? `${avgActiveCalories} active kcal/day average` : "Not enough activity data yet",
    preferredMeals,
    suggestions,
  });
});

router.get("/dashboard/progress", async (_req, res): Promise<void> => {
  const profiles = await db.select().from(userProfileTable).limit(1);
  if (profiles.length === 0) {
    res.status(404).json({ error: "No profile found" });
    return;
  }

  const profile = profiles[0];

  // Collect weight entries from daily logs
  const logs = await db
    .select()
    .from(dailyLogsTable)
    .orderBy(desc(dailyLogsTable.date))
    .limit(12);

  const weeklyTrend = logs
    .filter((l) => l.weightKg != null)
    .map((l) => ({ date: l.date, weightKg: l.weightKg as number }))
    .reverse();

  const bodyFatTrend = logs
    .filter((l) => l.bodyFatPercent != null)
    .map((l) => ({ date: l.date, bodyFatPercent: l.bodyFatPercent as number }))
    .reverse();

  const latestWeight = weeklyTrend[weeklyTrend.length - 1]?.weightKg ?? profile.currentWeightKg;
  const startWeight = weeklyTrend[0]?.weightKg ?? profile.currentWeightKg;
  const currentBodyFatPercent = bodyFatTrend[bodyFatTrend.length - 1]?.bodyFatPercent ?? profile.bodyFatPercent ?? null;
  const startBodyFatPercent = bodyFatTrend[0]?.bodyFatPercent ?? profile.bodyFatPercent ?? null;
  const kgLost = Math.max(0, startWeight - latestWeight);
  const kgToGo = Math.abs(latestWeight - profile.targetWeightKg);
  const totalToLose = Math.abs(profile.currentWeightKg - profile.targetWeightKg);
  const progressPercent = totalToLose > 0 ? Math.min(100, (kgLost / totalToLose) * 100) : 100;

  const metrics = calcGoalMetrics(profile);
  const estimatedWeeksRemaining = kgToGo / metrics.expectedWeeklyLossKg;

  res.json({
    currentWeightKg: latestWeight,
    targetWeightKg: profile.targetWeightKg,
    startWeightKg: startWeight,
    currentBodyFatPercent,
    startBodyFatPercent,
    kgLost: roundMoney(kgLost),
    kgToGo: roundMoney(kgToGo),
    progressPercent: roundNutrition(progressPercent),
    estimatedWeeksRemaining: roundNutrition(estimatedWeeksRemaining),
    weeklyTrend,
    bodyFatTrend,
  });
});

export default router;
