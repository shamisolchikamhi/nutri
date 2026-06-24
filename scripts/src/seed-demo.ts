export {};

const DEMO_ID = 900_000;

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

const today = isoDate();

const demo = {
  retailers: [
    { id: DEMO_ID + 1, name: "Fresh Market", marketCode: "ZA", logoUrl: "", isActive: true },
    { id: DEMO_ID + 2, name: "Value Grocer", marketCode: "ZA", logoUrl: "", isActive: true },
  ],
  products: [
    { id: DEMO_ID + 11, name: "Chicken Breast 500g", brand: "Farm Fresh", retailerId: DEMO_ID + 1, category: "protein", priceAud: 64.99, regularPriceAud: 79.99, packSize: 500, packUnit: "g", caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, fiberPer100g: 0, sugarPer100g: 0, isOnSpecial: true, imageUrl: "" },
    { id: DEMO_ID + 12, name: "Rolled Oats 1kg", brand: "Morning Bowl", retailerId: DEMO_ID + 2, category: "grains", priceAud: 42.99, regularPriceAud: null, packSize: 1, packUnit: "kg", caloriesPer100g: 379, proteinPer100g: 13.2, carbsPer100g: 67.7, fatPer100g: 6.5, fiberPer100g: 10.1, sugarPer100g: 1, isOnSpecial: false, imageUrl: "" },
    { id: DEMO_ID + 13, name: "Plain Greek Yoghurt 500g", brand: "Daily Dairy", retailerId: DEMO_ID + 1, category: "dairy", priceAud: 49.99, regularPriceAud: null, packSize: 500, packUnit: "g", caloriesPer100g: 97, proteinPer100g: 9, carbsPer100g: 3.9, fatPer100g: 5, fiberPer100g: 0, sugarPer100g: 3.9, isOnSpecial: false, imageUrl: "" },
    { id: DEMO_ID + 14, name: "Raw Almonds 200g", brand: "Simple Snacks", retailerId: DEMO_ID + 2, category: "snacks", priceAud: 54.99, regularPriceAud: null, packSize: 200, packUnit: "g", caloriesPer100g: 579, proteinPer100g: 21.2, carbsPer100g: 21.6, fatPer100g: 49.9, fiberPer100g: 12.5, sugarPer100g: 4.4, isOnSpecial: false, imageUrl: "" },
  ],
  recipes: [
    { id: DEMO_ID + 21, name: "Lemon Chicken Power Bowl", description: "A high-protein bowl with colourful vegetables and brown rice.", prepTimeMin: 15, cookTimeMin: 25, servings: 2, caloriesPerServing: 520, proteinPerServingG: 46, carbsPerServingG: 54, fatPerServingG: 14, fiberPerServingG: 8, difficulty: "easy", mealType: "lunch_dinner", tags: ["high_protein", "meal_prep"], estimatedCost: 48, imageUrl: "", instructions: ["Cook the brown rice.", "Season and grill the chicken.", "Serve with vegetables and lemon."] },
    { id: DEMO_ID + 22, name: "Berry Yoghurt Oats", description: "Overnight oats for a quick, balanced breakfast.", prepTimeMin: 10, cookTimeMin: 0, servings: 1, caloriesPerServing: 390, proteinPerServingG: 24, carbsPerServingG: 52, fatPerServingG: 9, fiberPerServingG: 8, difficulty: "easy", mealType: "breakfast", tags: ["vegetarian", "quick"], estimatedCost: 24, imageUrl: "", instructions: ["Mix oats, yoghurt, and milk.", "Chill overnight and top with berries."] },
  ],
  ingredients: [
    { id: DEMO_ID + 31, recipeId: DEMO_ID + 21, name: "Chicken breast", quantity: 300, unit: "g", calories: 495, proteinG: 93, carbsG: 0, fatG: 10.8, estimatedCost: 39, productId: DEMO_ID + 11, substitutes: ["firm tofu"] },
    { id: DEMO_ID + 32, recipeId: DEMO_ID + 21, name: "Brown rice", quantity: 150, unit: "g", calories: 168, proteinG: 3.9, carbsG: 34.5, fatG: 1.4, estimatedCost: 6, productId: null, substitutes: ["quinoa"] },
    { id: DEMO_ID + 33, recipeId: DEMO_ID + 22, name: "Rolled oats", quantity: 60, unit: "g", calories: 227, proteinG: 7.9, carbsG: 40.6, fatG: 3.9, estimatedCost: 3, productId: DEMO_ID + 12, substitutes: [] },
    { id: DEMO_ID + 34, recipeId: DEMO_ID + 22, name: "Greek yoghurt", quantity: 150, unit: "g", calories: 146, proteinG: 13.5, carbsG: 5.9, fatG: 7.5, estimatedCost: 15, productId: DEMO_ID + 13, substitutes: ["soy yoghurt"] },
  ],
  profile: [{ id: DEMO_ID + 1, currentWeightKg: 78, heightCm: 172, targetWeightKg: 72, ageYears: 32, sex: "female", activityLevel: "moderately_active", bodyFatPercent: null, dietPreference: "high_protein", budgetWeekly: 900, mealFrequency: 3, retailerPreferences: [String(DEMO_ID + 1), String(DEMO_ID + 2)] }],
  dailyLogs: [{ id: DEMO_ID + 41, date: today, waterMl: 1250, weightKg: 77.4, notes: "Demo day" }],
  meals: [
    { id: DEMO_ID + 51, date: today, mealType: "breakfast", name: "Berry Yoghurt Oats", calories: 390, proteinG: 24, carbsG: 52, fatG: 9, servings: 1, recipeId: DEMO_ID + 22, productId: null, isFavourite: true },
    { id: DEMO_ID + 52, date: today, mealType: "lunch", name: "Lemon Chicken Power Bowl", calories: 520, proteinG: 46, carbsG: 54, fatG: 14, servings: 1, recipeId: DEMO_ID + 21, productId: null, isFavourite: true },
  ],
  activities: [{ id: DEMO_ID + 61, date: today, steps: 6840, activeCalories: 180, workoutDurationMin: 35, workoutType: "strength", sleepHours: 7.5, notes: "Full-body session" }],
  specials: [{ id: DEMO_ID + 71, productId: DEMO_ID + 11, retailerId: DEMO_ID + 1, regularPriceAud: 79.99, specialPriceAud: 64.99, savingsAud: 15, savingsPercent: 18.75, goalFit: ["high_protein", "budget"], validFrom: isoDate(-1), validUntil: isoDate(7), lastVerifiedAt: new Date() }],
  baskets: [{ id: DEMO_ID + 81, name: "Demo weekly essentials", mode: "cheapest" }],
  basketItems: [
    { id: DEMO_ID + 91, basketId: DEMO_ID + 81, productId: DEMO_ID + 11, quantity: 2, unit: "pack", isSubstitute: false, isEssential: true },
    { id: DEMO_ID + 92, basketId: DEMO_ID + 81, productId: DEMO_ID + 12, quantity: 1, unit: "pack", isSubstitute: false, isEssential: true },
    { id: DEMO_ID + 93, basketId: DEMO_ID + 81, productId: DEMO_ID + 13, quantity: 1, unit: "pack", isSubstitute: false, isEssential: true },
  ],
};

const summary = Object.fromEntries(Object.entries(demo).map(([name, rows]) => [name, rows.length]));

if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify({ mode: "dry-run", date: today, rows: summary }, null, 2));
} else {
  const database = await import("@workspace/db");
  const {
    activityLogsTable, basketItemsTable, basketsTable, dailyLogsTable, db,
    mealEntriesTable, pool, productsTable, recipeIngredientsTable, recipesTable,
    retailersTable, specialsTable, userProfileTable,
  } = database;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(retailersTable).values(demo.retailers).onConflictDoNothing();
      await tx.insert(productsTable).values(demo.products).onConflictDoNothing();
      await tx.insert(recipesTable).values(demo.recipes).onConflictDoNothing();
      await tx.insert(recipeIngredientsTable).values(demo.ingredients).onConflictDoNothing();
      await tx.insert(userProfileTable).values(demo.profile).onConflictDoNothing();
      await tx.insert(dailyLogsTable).values(demo.dailyLogs).onConflictDoNothing();
      await tx.insert(mealEntriesTable).values(demo.meals).onConflictDoNothing();
      await tx.insert(activityLogsTable).values(demo.activities).onConflictDoNothing();
      await tx.insert(specialsTable).values(demo.specials).onConflictDoNothing();
      await tx.insert(basketsTable).values(demo.baskets).onConflictDoNothing();
      await tx.insert(basketItemsTable).values(demo.basketItems).onConflictDoNothing();
    });
    console.log(`Demo data ready: ${Object.values(summary).reduce((total, count) => total + count, 0)} rows considered.`);
  } finally {
    await pool.end();
  }
}
