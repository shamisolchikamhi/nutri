import { createServer } from "node:http";

let profile = {
  id: 1,
  sex: "male",
  ageYears: 41,
  currentWeightKg: 86,
  targetWeightKg: 78,
  heightCm: 181,
  bodyFatPercent: null,
  dietPreference: "standard",
  activityLevel: "moderately_active",
  budgetWeekly: 150,
  mealFrequency: 3,
  retailerPreferences: [],
};
let meals = [];
let waterMl = 0;
let weightKg = 86;
let activities = [];

const dashboard = {
  date: "2026-06-19",
  caloriesEaten: 0,
  caloriesRemaining: 2000,
  calorieTarget: 2000,
  proteinEatenG: 0,
  proteinRemainingG: 140,
  proteinTargetG: 140,
  carbsEatenG: 0,
  fatEatenG: 0,
  waterMl: 0,
  netCalorieBalance: 0,
  activeCaloriesBurned: 0,
  goalProgressPercent: 0,
  basketCost: null,
  savingsFromSpecials: 0,
  streak: 0,
  currentWeightKg: 86,
};

const goal = {
  maintenanceCalories: 2500,
  dailyCalorieTarget: 2000,
  dailyDeficit: 500,
  estimatedWeeksToGoal: 16,
  expectedWeeklyLossKg: 0.5,
  proteinTargetG: 140,
  carbsTargetG: 210,
  fatTargetG: 65,
  currentWeightKg: 86,
  targetWeightKg: 78,
  progressPercent: 0,
};

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => resolve(body ? JSON.parse(body) : {}));
  });
}

function dailyLog(date) {
  return {
    date,
    totalCalories: meals.reduce((sum, meal) => sum + meal.calories, 0),
    totalProteinG: meals.reduce((sum, meal) => sum + meal.proteinG, 0),
    totalCarbsG: meals.reduce((sum, meal) => sum + meal.carbsG, 0),
    totalFatG: meals.reduce((sum, meal) => sum + meal.fatG, 0),
    waterMl,
    calorieTarget: 2000,
    proteinTarget: 140,
    carbsTarget: 210,
    fatTarget: 65,
    adherencePercent: 0,
    streak: 1,
    weightKg,
    notes: null,
  };
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/healthz") return send(res, 200, { status: "ok", service: "nutribasket-api" });
  if (req.method === "GET" && req.url === "/api/profile") return profile ? send(res, 200, profile) : send(res, 404, { error: "Profile not found" });
  if (req.method === "PUT" && req.url === "/api/profile") {
    readJson(req).then((body) => {
      profile = { id: 1, ...body };
      send(res, 200, profile);
    });
    return;
  }
  const mealMatch = req.url.match(/^\/api\/logs\/daily\/([^/]+)\/meals$/);
  if (mealMatch && req.method === "GET") return send(res, 200, meals);
  if (mealMatch && req.method === "POST") {
    readJson(req).then((body) => {
      const meal = { id: meals.length + 1, date: mealMatch[1], ...body };
      meals.push(meal);
      send(res, 201, meal);
    });
    return;
  }
  const dailyMatch = req.url.match(/^\/api\/logs\/daily\/([^/]+)$/);
  if (dailyMatch && req.method === "GET") return send(res, 200, dailyLog(dailyMatch[1]));
  if (dailyMatch && req.method === "PUT") {
    readJson(req).then((body) => {
      if (typeof body.waterMl === "number") waterMl = body.waterMl;
      if (typeof body.weightKg === "number") weightKg = body.weightKg;
      send(res, 200, dailyLog(dailyMatch[1]));
    });
    return;
  }
  if (req.method === "GET" && req.url === "/api/logs/activity") return send(res, 200, activities);
  if (req.method === "POST" && req.url === "/api/logs/activity") {
    readJson(req).then((body) => {
      const activity = {
        id: activities.length + 1,
        ...body,
        estimatedCaloriesBurned: body.activeCalories + Math.round(body.workoutDurationMin * 6),
        netCalorieBalance: 0,
      };
      activities.push(activity);
      send(res, 201, activity);
    });
    return;
  }
  if (req.method === "GET" && req.url === "/api/dashboard/progress") {
    return send(res, 200, {
      currentWeightKg: weightKg,
      targetWeightKg: 78,
      startWeightKg: 86,
      kgLost: 86 - weightKg,
      kgToGo: weightKg - 78,
      progressPercent: ((86 - weightKg) / 8) * 100,
      estimatedWeeksRemaining: 14,
      weeklyTrend: [{ date: "2026-06-19", weightKg }],
    });
  }
  if (req.method === "GET" && req.url === "/api/dashboard/today") return send(res, 200, dashboard);
  if (req.method === "GET" && req.url === "/api/dashboard/snack-suggestions") return send(res, 200, []);
  if (req.method === "GET" && req.url === "/api/dashboard/meal-suggestion") return send(res, 200, null);
  if (req.method === "GET" && req.url === "/api/profile/goal-summary") return send(res, 200, goal);
  return send(res, 404, { error: `No fixture for ${req.method} ${req.url}` });
});

server.listen(5999, "127.0.0.1");
process.on("SIGTERM", () => server.close());
