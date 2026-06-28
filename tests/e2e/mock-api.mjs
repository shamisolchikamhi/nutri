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
let bodyFatPercent = 24;
let activities = [];
let socialRecipes = [];
let pantryItems = [];
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

let importedRecipe = recipe;
let activeBasket = basket;

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
  packSize: product.packSize,
  packUnit: product.packUnit,
  caloriesPer100g: product.caloriesPer100g,
  proteinPer100g: product.proteinPer100g,
  fiberPer100g: product.fiberPer100g,
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

function ingredientLinesFrom(body = {}) {
  const sourceText = [body.ingredientsText, body.caption].filter((value) => typeof value === "string").join("\n");
  return sourceText
    .split(/\r?\n|,/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => line.length > 2)
    .slice(0, 8);
}

function socialRecipeFixture(body = {}) {
  const sourceUrl = typeof body.sourceUrl === "string" && body.sourceUrl ? body.sourceUrl : "uploaded-media";
  const title = typeof body.title === "string" && body.title ? body.title : "Imported Social Chicken Bowl";
  const creatorHandle = typeof body.creatorHandle === "string" && body.creatorHandle ? body.creatorHandle : "@testcreator";
  const ingredientLines = ingredientLinesFrom(body);
  importedRecipe = {
    ...recipe,
    name: title,
    description: body.caption || "Imported from a social recipe.",
    ingredients: ingredientLines.length
      ? ingredientLines.map((name, index) => ({ name, quantity: 1, unit: index === 0 ? "pack" : "item", estimatedCost: index === 0 ? 35 : 12 }))
      : recipe.ingredients,
    instructions: body.caption ? String(body.caption).split(/\r?\n/).filter(Boolean).slice(0, 6) : ["Prepare the ingredients from the imported recipe."],
  };
  return {
    id: socialRecipes.length + 1,
    platform: body.platform || "tiktok",
    sourceUrl,
    creatorHandle,
    title,
    caption: body.caption || "Quick high-protein bowl imported from a social recipe.",
    marketCode: body.marketCode || "ZA",
    status: "imported",
    importedRecipeId: recipe.id,
    matchedCount: Math.max(1, ingredientLines.length),
    unmatchedIngredients: [],
    recipe: { ...importedRecipe, estimatedCost: Math.max(35, ingredientLines.length * 18) },
    matches: (ingredientLines.length ? ingredientLines : ["Imported ingredient"]).map((name, index) => ({
      name,
      quantity: 1,
      unit: index === 0 ? "pack" : "item",
      productId: index === 0 ? 10 : null,
      estimatedCost: index === 0 ? 35 : 12,
      calories: 120,
      proteinG: index === 0 ? 20 : 3,
      carbsG: index === 0 ? 0 : 18,
      fatG: index === 0 ? 4 : 2,
    })),
    aiExtractionUsed: false,
  };
}

function socialBasketFixture(imported) {
  const items = imported.matches.filter((match) => match.productId).map((match, index) => ({
    id: index + 1,
    basketId: 1,
    productId: match.productId,
    productName: match.name,
    retailerName: "Test Market",
    productUrl: "https://example.test/social-recipe-product",
    quantity: 1,
    unit: match.unit,
    unitCost: match.estimatedCost,
    totalCost: match.estimatedCost,
    isOnSpecial: false,
    category: "social",
  }));
  activeBasket = {
    ...basket,
    name: `${imported.title} Shopping`,
    items,
    totalCost: items.reduce((sum, item) => sum + item.totalCost, 0),
    totalCalories: imported.matches.reduce((sum, match) => sum + match.calories, 0),
    totalProteinG: imported.matches.reduce((sum, match) => sum + match.proteinG, 0),
    totalCarbsG: imported.matches.reduce((sum, match) => sum + match.carbsG, 0),
    totalFatG: imported.matches.reduce((sum, match) => sum + match.fatG, 0),
    totalServings: 2,
    costPerServing: Math.round((items.reduce((sum, item) => sum + item.totalCost, 0) / 2) * 100) / 100,
  };
  return activeBasket;
}

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

function parseMockPantryItems(rawText) {
  return String(rawText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").replace(/\s{2,}/g, " "))
    .filter((line) => line.length > 2)
    .slice(0, 10)
    .map((name, index) => ({
      id: pantryItems.length + index + 1,
      name,
      quantity: 1,
      unit: "item",
      category: /yoghurt|milk|cheese/i.test(name) ? "dairy" : /banana|spinach|broccoli/i.test(name) ? "fruit_veg" : "pantry",
      source: "receipt",
      expiresOn: "2026-06-28",
      confirmed: false,
      capturedAt: "2026-06-24T12:00:00.000Z",
      createdAt: "2026-06-24T12:00:00.000Z",
      updatedAt: "2026-06-24T12:00:00.000Z",
    }));
}

function mockPantrySuggestions() {
  const names = pantryItems.map((item) => item.name.toLowerCase());
  if (!names.some((name) => name.includes("rice") || name.includes("spinach") || name.includes("yoghurt"))) return [];
  return [{
    recipeId: recipe.id,
    name: recipe.name,
    matchedPantryItems: pantryItems.filter((item) => /rice|spinach|yoghurt/i.test(item.name)).map((item) => item.name),
    reason: "Uses pantry items before they expire.",
  }];
}

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
    bodyFatPercent,
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
      if (typeof body.bodyFatPercent === "number") bodyFatPercent = body.bodyFatPercent;
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
      currentBodyFatPercent: bodyFatPercent,
      startBodyFatPercent: 24,
      kgLost: 86 - weightKg,
      kgToGo: weightKg - 78,
      progressPercent: ((86 - weightKg) / 8) * 100,
      estimatedWeeksRemaining: 14,
      weeklyTrend: [{ date: "2026-06-19", weightKg }],
      bodyFatTrend: [{ date: "2026-06-19", bodyFatPercent }],
    });
  }
  if (req.method === "GET" && req.url === "/api/recipes/1") return send(res, 200, { ...importedRecipe, isSaved: recipeSaved });
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
  if (req.method === "POST" && req.url === "/api/baskets/from-recipes") return send(res, 201, activeBasket);
  if (req.method === "GET" && req.url === "/api/baskets/1") return send(res, 200, activeBasket);
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
  if (req.method === "GET" && req.url.startsWith("/api/market-intelligence")) {
    return send(res, 200, {
      marketCode: "ZA",
      season: "winter",
      stapleCategories: ["protein", "pantry", "fruit_veg", "dairy"],
      retailerHighlights: [{
        retailerId: 1,
        retailerName: "Test Market",
        productCount: 12,
        activeSpecialCount: 3,
        strength: "Test Market currently has 3 observed offer(s), strongest around protein.",
      }],
      packSizeNotes: ["Chicken Breast 500g: 500g at Test Market"],
      seasonalNotes: ["Soups, stews, legumes, citrus, oats, and frozen vegetables usually support budget and nutrition goals."],
      updatedAt: "2026-06-24T12:00:00.000Z",
    });
  }
  if (req.method === "GET" && req.url === "/api/pantry/items") return send(res, 200, pantryItems);
  if (req.method === "GET" && req.url === "/api/pantry/suggestions") return send(res, 200, mockPantrySuggestions());
  if (req.method === "POST" && req.url === "/api/pantry/capture") {
    readJson(req).then((body) => {
      const hasMedia = Array.isArray(body.mediaDataUrls) && body.mediaDataUrls.length > 0;
      if (!body.rawText && !hasMedia) {
        send(res, 400, { error: "Paste receipt or pantry text, or start the real API with OPENAI_API_KEY to analyze uploaded photos." });
        return;
      }
      const items = parseMockPantryItems(body.rawText || "Greek yoghurt 500g\nBananas x6");
      pantryItems = [...pantryItems, ...items];
      send(res, 201, { items, suggestedMeals: mockPantrySuggestions() });
    });
    return;
  }
  const pantryItemMatch = req.url.match(/^\/api\/pantry\/items\/(\d+)$/);
  if (pantryItemMatch && req.method === "PUT") {
    readJson(req).then((body) => {
      pantryItems = pantryItems.map((item) => item.id === Number(pantryItemMatch[1]) ? { ...item, ...body, updatedAt: "2026-06-24T12:05:00.000Z" } : item);
      send(res, 200, pantryItems.find((item) => item.id === Number(pantryItemMatch[1])));
    });
    return;
  }
  if (pantryItemMatch && req.method === "DELETE") {
    pantryItems = pantryItems.filter((item) => item.id !== Number(pantryItemMatch[1]));
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "GET" && req.url === "/api/social-recipes") return send(res, 200, socialRecipes);
  if (req.method === "POST" && req.url === "/api/social-recipes") {
    readJson(req).then((body) => {
      const hasMedia = Array.isArray(body.mediaDataUrls) && body.mediaDataUrls.length > 0;
      if (body.sourceUrl && !body.ingredientsText && !body.caption && !hasMedia) {
        send(res, 422, {
          error: "OpenAI analysis is not available in the local mock API. Start the real API with OPENAI_API_KEY, or paste the caption/ingredients or upload screenshots so the import can use visible recipe details.",
        });
        return;
      }
      const imported = socialRecipeFixture(body);
      socialRecipes.push(imported);
      send(res, 201, imported);
    });
    return;
  }
  const socialBasketMatch = req.url.match(/^\/api\/social-recipes\/(\d+)\/basket$/);
  if (socialBasketMatch && req.method === "POST") {
    const imported = socialRecipes.find((item) => item.id === Number(socialBasketMatch[1]));
    const createdBasket = imported ? socialBasketFixture(imported) : activeBasket;
    return send(res, 201, { basketId: createdBasket.id, basketName: createdBasket.name, itemCount: createdBasket.items.length, unmatchedIngredients: [] });
  }
  if (req.method === "GET" && req.url === "/api/dashboard/today") return send(res, 200, dashboard);
  if (req.method === "GET" && req.url === "/api/dashboard/weekly-review") return send(res, 200, {
    weekStart: "2026-06-18",
    weekEnd: "2026-06-24",
    adherencePercent: 71,
    spend: 70,
    wasteFlags: ["Repeated meals can be batch-prepped; check fresh ingredients before buying duplicate packs."],
    weightTrendKg: -0.5,
    energy: "220 active kcal/day average",
    preferredMeals: ["Egg (1 large)"],
    suggestions: ["Keep the current logging rhythm and review only the meals that missed your target.", "Before the next basket, swap one fresh bulk pack for a shelf-stable or frozen option if it will not be used twice."],
  });
  if (req.method === "GET" && req.url === "/api/dashboard/snack-suggestions") return send(res, 200, []);
  if (req.method === "GET" && req.url === "/api/dashboard/meal-suggestion") return send(res, 200, null);
  if (req.method === "GET" && req.url === "/api/profile/goal-summary") return send(res, 200, goal);
  return send(res, 404, { error: `No fixture for ${req.method} ${req.url}` });
});

server.listen(Number(process.env.PORT ?? 5999), "127.0.0.1");
process.on("SIGTERM", () => server.close());
