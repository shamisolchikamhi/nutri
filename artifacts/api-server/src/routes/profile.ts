import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, userProfileTable } from "@workspace/db";
import {
  UpsertProfileBody,
  GetProfileResponse,
  UpsertProfileResponse,
  GetGoalSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

let userProfileSchemaReady: Promise<void> | null = null;

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

function ensureUserProfileSchema() {
  userProfileSchemaReady ??= (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_profile (
        id serial PRIMARY KEY,
        current_weight_kg real NOT NULL DEFAULT 75,
        height_cm real NOT NULL DEFAULT 170,
        target_weight_kg real NOT NULL DEFAULT 70,
        age_years integer NOT NULL DEFAULT 30,
        sex text NOT NULL DEFAULT 'other',
        activity_level text NOT NULL DEFAULT 'moderately_active',
        body_fat_percent real,
        diet_preference text NOT NULL DEFAULT 'standard',
        budget_weekly real NOT NULL DEFAULT 150,
        meal_frequency integer NOT NULL DEFAULT 3,
        retailer_preferences text[] NOT NULL DEFAULT '{}',
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS current_weight_kg real NOT NULL DEFAULT 75`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS height_cm real NOT NULL DEFAULT 170`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS target_weight_kg real NOT NULL DEFAULT 70`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS age_years integer NOT NULL DEFAULT 30`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS sex text NOT NULL DEFAULT 'other'`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS activity_level text NOT NULL DEFAULT 'moderately_active'`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS body_fat_percent real`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS diet_preference text NOT NULL DEFAULT 'standard'`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS budget_weekly real NOT NULL DEFAULT 150`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS meal_frequency integer NOT NULL DEFAULT 3`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS retailer_preferences text[] NOT NULL DEFAULT '{}'`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now()`);
    await db.execute(sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now()`);
  })().catch((error) => {
    userProfileSchemaReady = null;
    throw error;
  });

  return userProfileSchemaReady;
}

function calcBMR(weight: number, height: number, age: number, sex: string) {
  if (sex === "male") return 10 * weight + 6.25 * height - 5 * age + 5;
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

function calcGoalMetrics(profile: {
  currentWeightKg: number;
  heightCm: number;
  ageYears: number;
  sex: string;
  activityLevel: string;
  targetWeightKg: number;
}) {
  const bmr = calcBMR(profile.currentWeightKg, profile.heightCm, profile.ageYears, profile.sex);
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel] ?? 1.375;
  const maintenanceCalories = Math.round(bmr * multiplier);
  const dailyDeficit = 500;
  const dailyCalorieTarget = Math.max(1200, maintenanceCalories - dailyDeficit);
  const dailyDeficitUsed = maintenanceCalories - dailyCalorieTarget;
  const expectedWeeklyLossKg = (dailyDeficitUsed * 7) / 7700;
  const kgToLose = Math.abs(profile.currentWeightKg - profile.targetWeightKg);
  const estimatedWeeksToGoal = expectedWeeklyLossKg > 0 ? kgToLose / expectedWeeklyLossKg : 0;

  const proteinTargetG = Math.round(profile.currentWeightKg * 2.0);
  const fatCalories = Math.round(dailyCalorieTarget * 0.25);
  const fatTargetG = Math.round(fatCalories / 9);
  const remainingCalories = dailyCalorieTarget - proteinTargetG * 4 - fatCalories;
  const carbsTargetG = Math.max(50, Math.round(remainingCalories / 4));

  return {
    maintenanceCalories,
    dailyCalorieTarget,
    dailyDeficit: dailyDeficitUsed,
    estimatedWeeksToGoal: Math.round(estimatedWeeksToGoal * 10) / 10,
    expectedWeeklyLossKg: Math.round(expectedWeeklyLossKg * 100) / 100,
    proteinTargetG,
    carbsTargetG,
    fatTargetG,
    currentWeightKg: profile.currentWeightKg,
    targetWeightKg: profile.targetWeightKg,
    progressPercent: 0,
  };
}

router.get("/profile", async (req, res): Promise<void> => {
  await ensureUserProfileSchema();
  const profiles = await db.select().from(userProfileTable).limit(1);
  if (profiles.length === 0) {
    res.status(404).json({ error: "No profile found" });
    return;
  }
  const profile = profiles[0];
  const data = {
    ...profile,
    retailerPreferences: (profile.retailerPreferences ?? []).map(Number),
  };
  res.json(GetProfileResponse.parse(data));
});

router.put("/profile", async (req, res): Promise<void> => {
  await ensureUserProfileSchema();
  const parsed = UpsertProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(userProfileTable).limit(1);
  const input = {
    ...parsed.data,
    retailerPreferences: (parsed.data.retailerPreferences ?? []).map(String),
  };

  let profile;
  if (existing.length > 0) {
    const [updated] = await db
      .update(userProfileTable)
      .set(input)
      .returning();
    profile = updated;
  } else {
    const [created] = await db
      .insert(userProfileTable)
      .values(input)
      .returning();
    profile = created;
  }

  const data = {
    ...profile,
    retailerPreferences: (profile.retailerPreferences ?? []).map(Number),
  };
  res.json(UpsertProfileResponse.parse(data));
});

router.get("/profile/goal-summary", async (req, res): Promise<void> => {
  await ensureUserProfileSchema();
  const profiles = await db.select().from(userProfileTable).limit(1);
  if (profiles.length === 0) {
    res.status(404).json({ error: "No profile found" });
    return;
  }
  const profile = profiles[0];
  const metrics = calcGoalMetrics(profile);
  res.json(GetGoalSummaryResponse.parse(metrics));
});

export { calcGoalMetrics, calcBMR, ACTIVITY_MULTIPLIERS, ensureUserProfileSchema };
export default router;
