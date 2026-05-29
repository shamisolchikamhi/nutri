import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  db,
  dailyLogsTable,
  mealEntriesTable,
  activityLogsTable,
  userProfileTable,
} from "@workspace/db";
import {
  GetDailyLogParams,
  UpsertDailyLogBody,
  UpsertDailyLogParams,
  GetMealEntriesParams,
  AddMealEntryBody,
  AddMealEntryParams,
  DeleteMealEntryParams,
  ListDailyLogsQueryParams,
  ListActivityLogsQueryParams,
  CreateActivityLogBody,
  UpdateActivityLogBody,
  UpdateActivityLogParams,
  DeleteActivityLogParams,
  GetWeeklySummaryResponse,
} from "@workspace/api-zod";
import { calcGoalMetrics, ACTIVITY_MULTIPLIERS } from "./profile";

const router: IRouter = Router();

function parseDate(raw: unknown): string {
  return Array.isArray(raw) ? raw[0] : String(raw);
}

function parseId(raw: unknown): number {
  return parseInt(Array.isArray(raw) ? raw[0] : String(raw), 10);
}

async function getOrCreateDailyLog(date: string) {
  const existing = await db
    .select()
    .from(dailyLogsTable)
    .where(eq(dailyLogsTable.date, date))
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [created] = await db
    .insert(dailyLogsTable)
    .values({ date, waterMl: 0 })
    .returning();
  return created;
}

async function buildDailyLogResponse(date: string) {
  const log = await getOrCreateDailyLog(date);
  const meals = await db
    .select()
    .from(mealEntriesTable)
    .where(eq(mealEntriesTable.date, date));

  const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
  const totalProteinG = meals.reduce((s, m) => s + m.proteinG, 0);
  const totalCarbsG = meals.reduce((s, m) => s + m.carbsG, 0);
  const totalFatG = meals.reduce((s, m) => s + m.fatG, 0);

  const profiles = await db.select().from(userProfileTable).limit(1);
  let calorieTarget = 2000;
  let proteinTarget = 150;
  let carbsTarget = 200;
  let fatTarget = 60;
  if (profiles.length > 0) {
    const metrics = calcGoalMetrics(profiles[0]);
    calorieTarget = metrics.dailyCalorieTarget;
    proteinTarget = metrics.proteinTargetG;
    carbsTarget = metrics.carbsTargetG;
    fatTarget = metrics.fatTargetG;
  }

  const adherencePercent = calorieTarget > 0
    ? Math.min(100, (totalCalories / calorieTarget) * 100)
    : 0;

  // Simple streak: count consecutive days with meals
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const count = await db
      .select()
      .from(mealEntriesTable)
      .where(eq(mealEntriesTable.date, ds));
    if (count.length > 0) streak++;
    else if (i > 0) break;
  }

  return {
    date: log.date,
    totalCalories,
    totalProteinG: Math.round(totalProteinG * 10) / 10,
    totalCarbsG: Math.round(totalCarbsG * 10) / 10,
    totalFatG: Math.round(totalFatG * 10) / 10,
    waterMl: log.waterMl,
    calorieTarget,
    proteinTarget,
    carbsTarget,
    fatTarget,
    adherencePercent: Math.round(adherencePercent * 10) / 10,
    streak,
    weightKg: log.weightKg ?? null,
    notes: log.notes ?? null,
  };
}

// ---- Daily Logs ----
router.get("/logs/daily", async (req, res): Promise<void> => {
  const params = ListDailyLogsQueryParams.safeParse(req.query);
  const logs = await db
    .select()
    .from(dailyLogsTable)
    .orderBy(desc(dailyLogsTable.date))
    .limit(30);

  const results = await Promise.all(logs.map((l) => buildDailyLogResponse(l.date)));
  res.json(results);
});

router.get("/logs/daily/:date", async (req, res): Promise<void> => {
  const date = parseDate(req.params.date);
  const result = await buildDailyLogResponse(date);
  res.json(result);
});

router.put("/logs/daily/:date", async (req, res): Promise<void> => {
  const date = parseDate(req.params.date);
  const parsed = UpsertDailyLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await getOrCreateDailyLog(date);
  await db
    .update(dailyLogsTable)
    .set({ ...parsed.data })
    .where(eq(dailyLogsTable.date, date));

  const result = await buildDailyLogResponse(date);
  res.json(result);
});

// ---- Meal Entries ----
router.get("/logs/daily/:date/meals", async (req, res): Promise<void> => {
  const date = parseDate(req.params.date);
  const meals = await db
    .select()
    .from(mealEntriesTable)
    .where(eq(mealEntriesTable.date, date));
  res.json(meals);
});

router.post("/logs/daily/:date/meals", async (req, res): Promise<void> => {
  const date = parseDate(req.params.date);
  const parsed = AddMealEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entry] = await db
    .insert(mealEntriesTable)
    .values({ ...parsed.data, date })
    .returning();

  res.status(201).json(entry);
});

router.delete("/logs/daily/:date/meals/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(mealEntriesTable).where(eq(mealEntriesTable.id, id));
  res.sendStatus(204);
});

// ---- Weekly Summary ----
router.get("/logs/weekly-summary", async (req, res): Promise<void> => {
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const dayResults = await Promise.all(days.map(buildDailyLogResponse));

  const daysOnTarget = dayResults.filter(
    (d) => d.totalCalories > 0 && d.adherencePercent >= 80 && d.adherencePercent <= 115
  ).length;

  const totalCaloriesConsumed = dayResults.reduce((s, d) => s + d.totalCalories, 0);
  const daysWithData = dayResults.filter((d) => d.totalCalories > 0);
  const avgDailyCalories =
    daysWithData.length > 0
      ? Math.round(totalCaloriesConsumed / daysWithData.length)
      : 0;
  const avgDailyProteinG =
    daysWithData.length > 0
      ? Math.round(daysWithData.reduce((s, d) => s + d.totalProteinG, 0) / daysWithData.length * 10) / 10
      : 0;
  const avgDailyWaterMl =
    daysWithData.length > 0
      ? Math.round(daysWithData.reduce((s, d) => s + d.waterMl, 0) / daysWithData.length)
      : 0;

  res.json(
    GetWeeklySummaryResponse.parse({
      weekStart: days[0],
      weekEnd: days[6],
      avgDailyCalories,
      avgDailyProteinG,
      avgDailyWaterMl,
      daysOnTarget,
      totalCaloriesConsumed,
      streak: dayResults[6].streak,
      days: dayResults,
    })
  );
});

// ---- Activity Logs ----
router.get("/logs/activity", async (req, res): Promise<void> => {
  const params = ListActivityLogsQueryParams.safeParse(req.query);
  let query = db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.date)).$dynamic();

  const logs = await query.limit(30);

  const profiles = await db.select().from(userProfileTable).limit(1);
  const profile = profiles[0];
  const calorieTarget = profile ? calcGoalMetrics(profile).dailyCalorieTarget : 2000;

  const result = logs.map((l) => {
    const estimatedCaloriesBurned = l.activeCalories + Math.round(l.workoutDurationMin * 6);
    return {
      ...l,
      estimatedCaloriesBurned,
      netCalorieBalance: calorieTarget - estimatedCaloriesBurned,
    };
  });

  res.json(result);
});

router.post("/logs/activity", async (req, res): Promise<void> => {
  const parsed = CreateActivityLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date: dateVal, ...rest } = parsed.data;
  const dateStr = dateVal instanceof Date ? dateVal.toISOString().split("T")[0] : String(dateVal);
  const [log] = await db.insert(activityLogsTable).values({ ...rest, date: dateStr }).returning();
  const profiles = await db.select().from(userProfileTable).limit(1);
  const profile = profiles[0];
  const calorieTarget = profile ? calcGoalMetrics(profile).dailyCalorieTarget : 2000;
  const estimatedCaloriesBurned = log.activeCalories + Math.round(log.workoutDurationMin * 6);

  res.status(201).json({
    ...log,
    estimatedCaloriesBurned,
    netCalorieBalance: calorieTarget - estimatedCaloriesBurned,
  });
});

router.put("/logs/activity/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const parsed = UpdateActivityLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date: dateVal2, ...restUpdate } = parsed.data;
  const dateStr2 = dateVal2 instanceof Date ? dateVal2.toISOString().split("T")[0] : String(dateVal2);
  const [log] = await db
    .update(activityLogsTable)
    .set({ ...restUpdate, date: dateStr2 })
    .where(eq(activityLogsTable.id, id))
    .returning();

  if (!log) {
    res.status(404).json({ error: "Activity log not found" });
    return;
  }

  const profiles = await db.select().from(userProfileTable).limit(1);
  const profile = profiles[0];
  const calorieTarget = profile ? calcGoalMetrics(profile).dailyCalorieTarget : 2000;
  const estimatedCaloriesBurned = log.activeCalories + Math.round(log.workoutDurationMin * 6);

  res.json({
    ...log,
    estimatedCaloriesBurned,
    netCalorieBalance: calorieTarget - estimatedCaloriesBurned,
  });
});

router.delete("/logs/activity/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(activityLogsTable).where(eq(activityLogsTable.id, id));
  res.sendStatus(204);
});

export default router;
