import { Router, type IRouter } from "express";
import { db, userProfileTable } from "@workspace/db";
import {
  UpsertProfileBody,
  GetProfileResponse,
  UpsertProfileResponse,
  GetGoalSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

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
  const profiles = await db.select().from(userProfileTable).limit(1);
  if (profiles.length === 0) {
    res.status(404).json({ error: "No profile found" });
    return;
  }
  const profile = profiles[0];
  const metrics = calcGoalMetrics(profile);
  res.json(GetGoalSummaryResponse.parse(metrics));
});

export { calcGoalMetrics, calcBMR, ACTIVITY_MULTIPLIERS };
export default router;
