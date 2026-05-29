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

  let calorieTarget = 2000;
  let proteinTarget = 150;
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
    basketCost = Math.round(cost * 100) / 100;
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
    proteinEatenG: Math.round(proteinEatenG * 10) / 10,
    proteinRemainingG: Math.max(0, Math.round((proteinTarget - proteinEatenG) * 10) / 10),
    proteinTargetG: proteinTarget,
    carbsEatenG: Math.round(carbsEatenG * 10) / 10,
    fatEatenG: Math.round(fatEatenG * 10) / 10,
    waterMl: log?.waterMl ?? 0,
    netCalorieBalance: calorieTarget - caloriesEaten + activeCaloriesBurned,
    activeCaloriesBurned,
    goalProgressPercent: Math.round(goalProgressPercent * 10) / 10,
    basketCost,
    savingsFromSpecials: Math.round(savingsFromSpecials * 100) / 100,
    streak,
    currentWeightKg,
  });
});

router.get("/dashboard/snack-suggestions", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const meals = await db.select().from(mealEntriesTable).where(eq(mealEntriesTable.date, today));
  const caloriesEaten = meals.reduce((s, m) => s + m.calories, 0);

  const profiles = await db.select().from(userProfileTable).limit(1);
  const calorieTarget = profiles[0] ? calcGoalMetrics(profiles[0]).dailyCalorieTarget : 2000;
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
          proteinPerServingG: Math.round((p.proteinPer100g * servingG) / 100 * 10) / 10,
          sugarPerServingG: Math.round(((p.sugarPer100g ?? 0) * servingG) / 100 * 10) / 10,
          fatPerServingG: Math.round((p.fatPer100g * servingG) / 100 * 10) / 10,
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
  const calorieTarget = profiles[0] ? calcGoalMetrics(profiles[0]).dailyCalorieTarget : 2000;
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

  const latestWeight = weeklyTrend[weeklyTrend.length - 1]?.weightKg ?? profile.currentWeightKg;
  const startWeight = weeklyTrend[0]?.weightKg ?? profile.currentWeightKg;
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
    kgLost: Math.round(kgLost * 100) / 100,
    kgToGo: Math.round(kgToGo * 100) / 100,
    progressPercent: Math.round(progressPercent * 10) / 10,
    estimatedWeeksRemaining: Math.round(estimatedWeeksRemaining * 10) / 10,
    weeklyTrend,
  });
});

export default router;
