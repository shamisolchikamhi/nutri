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
let recipeSaved = false;
const recentlyVerifiedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

const recipe = {
  id: 1,
  name: "High Protein Chicken Bowl",
  description: "A quick balanced dinner.",
  prepTimeMin: 10,
  cookTimeMin: 20,
  servings: 2,
  caloriesPerServing: 520,
  proteinPerServingG: 48,
  carbsPerServingG: 52,
  fatPerServingG: 14,
  fiberPerServingG: 8,
  difficulty: "easy",
  tags: ["high_protein", "dinner"],
  estimatedCost: 92,
  imageUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  ingredients: [
    { name: "Chicken breast", quantity: 2, unit: "pack", estimatedCost: 70 },
    { name: "Brown rice", quantity: 1, unit: "pack", estimatedCost: 22 },
  ],
  instructions: ["Cook the rice.", "Grill the chicken and serve."],
};

const basket = {
  id: 1,
  name: "High Protein Chicken Bowl Shopping",
  mode: "cheapest",
  items: [
    {
      id: 1,
      basketId: 1,
      productId: 10,
      productName: "Chicken Breast 500g",
      retailerName: "Test Market",
      productUrl: "https://example.test/chicken",
      quantity: 2,
      unit: "pack",
      unitCost: 35,
      totalCost: 70,
      isOnSpecial: false,
      category: "protein",
    },
  ],
  totalCost: 70,
  totalCalories: 1200,
  totalProteinG: 220,
  totalCarbsG: 0,
  totalFatG: 20,
  totalServings: 2,
  costPerServing: 35,
  savingsFromSpecials: 0,
  createdAt: "2026-06-19T12:00:00.000Z",
  storeComparisons: [
    { retailerName: "Test Market", matchedItems: 1, totalItems: 1, totalCost: 70 },
    { retailerName: "Value Mart", matchedItems: 1, totalItems: 1, totalCost: 76 },
  ],
};

const product = {
  id: 10,
  name: "Chicken Breast 500g",
  brand: "Farm Fresh",
  retailerId: 1,
  retailerName: "Test Market",
  category: "protein",
  priceAud: 35,
  regularPriceAud: 42,
  canonicalSourceUrl: "https://example.test/chicken",
  region: "Gauteng",
  store: "Online",
  channel: "delivery",
  currency: "ZAR",
  packSize: 500,
  packUnit: "g",
  caloriesPer100g: 165,
  proteinPer100g: 31,
  carbsPer100g: 0,
  fatPer100g: 3.6,
  fiberPer100g: 0,
  sugarPer100g: 0,
  isOnSpecial: true,
  stockStatus: "in_stock",
  savingsPercent: 17,
  savingsAud: 7,
  lastVerifiedAt: recentlyVerifiedAt,
  imageUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
};

const special = {
  id: 1,
  productId: 10,
  productName: "Chicken Breast 500g",
  retailerId: 1,
  retailerName: "Test Market",
  regularPriceAud: 42,
  specialPriceAud: 35,
  savingsAud: 7,
  savingsPercent: 17,
  category: "protein",
  imageUrl: product.imageUrl,
  goalFit: ["high_protein", "budget"],
  promotionType: "multibuy",
  multibuyQuantity: 2,
  multibuyPrice: 60,
  loyaltyRequired: true,
  stockStatus: "limited_stock",
  region: "Gauteng",
  store: "Online",
  channel: "delivery",
  currency: "ZAR",
  terms: "While stocks last",
  sourceUrl: "https://example.test/specials/chicken",
  validFrom: "2026-06-01",
  validUntil: "2026-06-30",
  lastVerifiedAt: recentlyVerifiedAt,
};

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
  const mealDeleteMatch = req.url.match(/^\/api\/logs\/daily\/([^/]+)\/meals\/(\d+)$/);
  if (mealDeleteMatch && req.method === "DELETE") {
    meals = meals.filter((meal) => meal.id !== Number(mealDeleteMatch[2]));
    res.writeHead(204);
    return res.end();
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
  if (req.method === "GET" && req.url === "/api/logs/weekly-summary") return send(res, 200, { weekStart: "2026-06-15", weekEnd: "2026-06-21", avgDailyCalories: 0, avgDailyProteinG: 0, avgDailyWaterMl: 0, daysOnTarget: 0, totalCaloriesConsumed: 0, streak: 0, days: [] });
  if (req.method === "GET" && req.url === "/api/logs/daily") return send(res, 200, []);
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
  if (req.method === "GET" && req.url === "/api/recipes/1") return send(res, 200, { ...recipe, isSaved: recipeSaved });
  if (req.method === "GET" && req.url === "/api/recipes/1/related") return send(res, 200, []);
  if (req.method === "GET" && req.url.startsWith("/api/recipes/meal-plan")) {
    return send(res, 200, {
      calorieTarget: 2000,
      proteinTargetG: 140,
      householdSize: 2,
      budgetWeekly: 900,
      maxCookingTime: 45,
      dietaryRules: [],
      pantryItems: ["rice"],
      preferredRetailers: ["Test Market"],
      savedRecipeCount: 1,
      days: [{
        day: 1,
        label: "Today",
        items: [{
          slot: "lunch",
          slotLabel: "Lunch",
          explanation: "Lunch: balances 48g protein with 520 kcal. Cost trade-off: about R 184 for 2 household members. Time trade-off: 30 minutes prep/cook. Waste trade-off: uses pantry item rice to reduce waste.",
          recipe: { ...recipe, mealTypeLabel: "Lunch/Dinner", isSaved: true },
        }],
        totals: {
          calories: 520,
          proteinG: 48,
          carbsG: 52,
          fatG: 14,
          cost: 92,
          householdCost: 184,
          budgetRemaining: 716,
          calorieTarget: 2000,
          proteinTargetG: 140,
          calorieCoveragePercent: 26,
          proteinCoveragePercent: 34,
        },
      }],
    });
  }
  if (req.method === "GET" && req.url.startsWith("/api/recipes/adaptive-replan")) {
    return send(res, 200, {
      remainingCalories: 1180,
      remainingProteinG: 92,
      recommendation: {
        id: 1,
        name: "High Protein Chicken Bowl",
        caloriesPerServing: 520,
        proteinPerServingG: 48,
        estimatedCost: 92,
        reason: "Rebalances the day toward 1180 kcal and 92g protein remaining after logged meals and workouts.",
        substitutions: [{ ingredient: "Chicken breast", substitute: "firm tofu", reason: "Use firm tofu if Chicken breast is unavailable or too expensive; keeps the recipe role similar without changing the macro target materially." }],
        leftovers: "Cook 2 servings and carry leftovers into tomorrow's lunch.",
        wasteFlags: ["Brown rice may leave extra g; plan another meal using it this week."],
      },
    });
  }
  if (req.method === "POST" && req.url === "/api/saved/recipes") {
    recipeSaved = true;
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "POST" && req.url === "/api/baskets/from-recipes") return send(res, 201, basket);
  if (req.method === "GET" && req.url === "/api/baskets/1") return send(res, 200, basket);
  if (req.method === "GET" && req.url === "/api/baskets") return send(res, 200, []);
  if (req.method === "GET" && req.url === "/api/retailers") return send(res, 200, [{ id: 1, name: "Test Market", marketCode: "ZA", logoUrl: "", isActive: true }]);
  if (req.method === "GET" && req.url.startsWith("/api/products?")) {
    const requestUrl = new URL(req.url, "http://127.0.0.1");
    return send(res, 200, requestUrl.searchParams.get("query") === "missing" ? [] : [product]);
  }
  if (req.method === "GET" && req.url === "/api/products") return send(res, 200, [product]);
  if (req.method === "GET" && req.url === "/api/products/10/compare") {
    return send(res, 200, [
      { product, pricePerUnit: 0.07, isCheapest: true, isBestValue: true },
      { product: { ...product, id: 11, retailerName: "Value Mart", priceAud: 38 }, pricePerUnit: 0.076, isCheapest: false, isBestValue: false },
    ]);
  }
  if (req.method === "GET" && req.url === "/api/specials/best-value") return send(res, 200, [{ ...special, id: 2, productName: "Best Value Chicken" }]);
  if (req.method === "GET" && req.url.startsWith("/api/specials")) return send(res, 200, [special]);
  if (req.method === "GET" && req.url === "/api/retailer-status") {
    return send(res, 200, {
      generatedAt: new Date().toISOString(),
      retailers: [{
        retailerId: 1,
        retailerName: "Test Market",
        marketCode: "ZA",
        channel: "delivery",
        isActive: true,
        productCount: 12,
        activePromotionCount: 3,
        stalePromotionCount: 1,
        scrapedAt: recentlyVerifiedAt,
        lastVerifiedAt: recentlyVerifiedAt,
        verifiedHoursAgo: 3,
        status: "healthy",
      }],
    });
  }
  if (req.method === "GET" && req.url === "/api/saved/recipes") return send(res, 200, []);
  if (req.method === "GET" && req.url === "/api/saved/snacks") return send(res, 200, []);
  if (req.method === "GET" && req.url === "/api/social-recipes") return send(res, 200, []);
  if (req.method === "GET" && req.url === "/api/dashboard/today") return send(res, 200, dashboard);
  if (req.method === "GET" && req.url === "/api/dashboard/snack-suggestions") return send(res, 200, []);
  if (req.method === "GET" && req.url === "/api/dashboard/meal-suggestion") return send(res, 200, null);
  if (req.method === "GET" && req.url === "/api/profile/goal-summary") return send(res, 200, goal);
  return send(res, 404, { error: `No fixture for ${req.method} ${req.url}` });
});

server.listen(5999, "127.0.0.1");
process.on("SIGTERM", () => server.close());
