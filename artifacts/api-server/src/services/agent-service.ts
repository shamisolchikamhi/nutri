import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  activityLogsTable,
  agentActionsTable,
  basketItemsTable,
  basketsTable,
  dailyLogsTable,
  db,
  mealEntriesTable,
  nutritionCatalogTable,
  pantryItemsTable,
  productsTable,
  recipesTable,
  savedRecipesTable,
  userProfileTable,
} from "@workspace/db";
import { createBasketFromRecipes } from "./basket-service";

export type AgentActionKind =
  | "pantry.add"
  | "meal.add"
  | "water.add"
  | "daily.update"
  | "activity.add"
  | "profile.update"
  | "favorite.add"
  | "plan.accept"
  | "basket.create"
  | "basket_item.add";

export type AgentProposal = {
  id: number;
  kind: AgentActionKind;
  summary: string;
  payload: Record<string, unknown>;
  expiresAt: string;
};

export type AgentChatResult = {
  message: string;
  followUpQuestions: string[];
  proposals: AgentProposal[];
  source: "deterministic" | "openai";
};

type Draft = { kind: AgentActionKind; summary: string; payload: Record<string, unknown> };

const ACTION_KINDS = new Set<AgentActionKind>([
  "pantry.add", "meal.add", "water.add", "daily.update", "activity.add", "profile.update",
  "favorite.add", "plan.accept", "basket.create", "basket_item.add",
]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function numberFrom(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function outputTextFromResponse(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const direct = (data as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;
  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  return output.flatMap((item) => {
    if (!item || typeof item !== "object" || !Array.isArray((item as { content?: unknown }).content)) return [];
    return ((item as { content: unknown[] }).content).flatMap((part) =>
      part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? [(part as { text: string }).text] : [],
    );
  }).join("\n");
}

function publicAction(action: typeof agentActionsTable.$inferSelect): AgentProposal {
  return {
    id: action.id,
    kind: action.kind as AgentActionKind,
    summary: action.summary,
    payload: action.payload as Record<string, unknown>,
    expiresAt: action.expiresAt.toISOString(),
  };
}

function validateDraftPayload(kind: AgentActionKind, payload: Record<string, unknown>) {
  const positive = (key: string, max: number) => {
    const value = numberFrom(payload[key]);
    if (value == null || value <= 0 || value > max) throw new Error(`${key} is outside the supported range`);
  };
  if (kind === "water.add") positive("amountMl", 10_000);
  if (kind === "pantry.add") {
    if (!String(payload.name ?? "").trim()) throw new Error("Pantry item name is required");
    positive("quantity", 10_000);
  }
  if (kind === "meal.add") {
    if (!String(payload.name ?? "").trim()) throw new Error("Meal name is required");
    for (const key of ["calories", "proteinG", "carbsG", "fatG", "servings"]) {
      const value = numberFrom(payload[key]);
      if (value == null || value < 0 || value > 20_000) throw new Error(`${key} is outside the supported range`);
    }
  }
  if (kind === "daily.update") {
    const weight = numberFrom(payload.weightKg);
    const bodyFat = numberFrom(payload.bodyFatPercent);
    if (weight != null && (weight < 20 || weight > 400)) throw new Error("Weight must be between 20 and 400 kg");
    if (bodyFat != null && (bodyFat < 1 || bodyFat > 75)) throw new Error("Body fat must be between 1% and 75%");
    if (weight == null && bodyFat == null && typeof payload.notes !== "string") throw new Error("No daily log value was supplied");
  }
  if (kind === "activity.add") positive("workoutDurationMin", 1_440);
  if (kind === "favorite.add") positive("recipeId", Number.MAX_SAFE_INTEGER);
  if (kind === "plan.accept") {
    if (!Array.isArray(payload.recipeIds) || payload.recipeIds.length === 0) throw new Error("At least one recipe is required");
  }
  if (kind === "basket.create" && !String(payload.name ?? "").trim()) throw new Error("Shop name is required");
  if (kind === "basket_item.add") {
    positive("basketId", Number.MAX_SAFE_INTEGER);
    positive("productId", Number.MAX_SAFE_INTEGER);
    positive("quantity", 1_000);
  }
  if (kind === "profile.update") {
    const allowed = new Set(["currentWeightKg", "heightCm", "targetWeightKg", "ageYears", "sex", "activityLevel", "bodyFatPercent", "dietPreference", "budgetWeekly", "mealFrequency", "retailerPreferences"]);
    if (Object.keys(payload).length === 0 || Object.keys(payload).some((key) => !allowed.has(key))) throw new Error("Profile update contains unsupported fields");
    const budget = numberFrom(payload.budgetWeekly);
    if (budget != null && (budget < 0 || budget > 1_000_000)) throw new Error("Weekly budget is outside the supported range");
    const ranges: Record<string, [number, number]> = {
      currentWeightKg: [20, 400], targetWeightKg: [20, 400], heightCm: [100, 250], ageYears: [13, 120],
      bodyFatPercent: [1, 75], mealFrequency: [1, 12],
    };
    for (const [key, [minimum, maximum]] of Object.entries(ranges)) {
      const value = numberFrom(payload[key]);
      if (value != null && (value < minimum || value > maximum)) throw new Error(`${key} is outside the supported range`);
    }
    if (payload.sex != null && !["male", "female", "other"].includes(String(payload.sex))) throw new Error("Sex value is unsupported");
    if (payload.activityLevel != null && !["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"].includes(String(payload.activityLevel))) throw new Error("Activity level is unsupported");
    if (payload.dietPreference != null && !["standard", "high_protein", "low_calorie", "low_carb", "vegan", "halal", "vegetarian"].includes(String(payload.dietPreference))) throw new Error("Diet preference is unsupported");
  }
  return payload;
}

async function persistDraft(draft: Draft) {
  validateDraftPayload(draft.kind, draft.payload);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const idempotencyKey = createHash("sha256").update(`${randomUUID()}:${draft.kind}:${JSON.stringify(draft.payload)}`).digest("hex");
  const [action] = await db.insert(agentActionsTable).values({ ...draft, idempotencyKey, expiresAt }).returning();
  return publicAction(action);
}

function mealTypeFrom(text: string) {
  if (/breakfast/i.test(text)) return "breakfast";
  if (/lunch/i.test(text)) return "lunch";
  if (/snack/i.test(text)) return "snack";
  return "dinner";
}

async function foodDraft(text: string): Promise<Draft | null> {
  const [recipes, products, catalog] = await Promise.all([
    db.select().from(recipesTable),
    db.select().from(productsTable),
    db.select().from(nutritionCatalogTable),
  ]);
  const normalized = text.toLowerCase();
  const recipe = recipes.filter((item) => normalized.includes(item.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
  if (recipe) {
    return {
      kind: "meal.add",
      summary: `Log ${recipe.name} as ${mealTypeFrom(text)} (${recipe.caloriesPerServing} kcal)` ,
      payload: { date: today(), mealType: mealTypeFrom(text), name: recipe.name, calories: recipe.caloriesPerServing, proteinG: recipe.proteinPerServingG, carbsG: recipe.carbsPerServingG, fatG: recipe.fatPerServingG, servings: 1, recipeId: recipe.id, productId: null, isFavourite: false, nutritionSource: "recipe", servingAssumption: "1 recipe serving" },
    };
  }
  const product = products.filter((item) => normalized.includes(item.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
  if (product) {
    const grams = ["kg", "l"].includes(product.packUnit) ? product.packSize * 1000 : ["g", "ml"].includes(product.packUnit) ? product.packSize : 100;
    const multiplier = grams / 100;
    return {
      kind: "meal.add",
      summary: `Log ${product.name} as ${mealTypeFrom(text)} (${Math.round(product.caloriesPer100g * multiplier)} kcal)`,
      payload: { date: today(), mealType: mealTypeFrom(text), name: product.name, calories: Math.round(product.caloriesPer100g * multiplier), proteinG: product.proteinPer100g * multiplier, carbsG: product.carbsPer100g * multiplier, fatG: product.fatPer100g * multiplier, servings: 1, recipeId: null, productId: product.id, isFavourite: false, nutritionSource: "retailer_product", servingAssumption: `1 ${product.packSize}${product.packUnit} pack` },
    };
  }
  const nutrition = catalog.filter((item) => normalized.includes(item.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
  if (nutrition) {
    const grams = ["kg", "l"].includes(nutrition.packUnit) ? nutrition.packSize * 1000 : ["g", "ml"].includes(nutrition.packUnit) ? nutrition.packSize : 100;
    const multiplier = grams / 100;
    return {
      kind: "meal.add",
      summary: `Log ${nutrition.name} as ${mealTypeFrom(text)} (${Math.round(nutrition.caloriesPer100g * multiplier)} kcal)`,
      payload: { date: today(), mealType: mealTypeFrom(text), name: nutrition.name, calories: Math.round(nutrition.caloriesPer100g * multiplier), proteinG: nutrition.proteinPer100g * multiplier, carbsG: nutrition.carbsPer100g * multiplier, fatG: nutrition.fatPer100g * multiplier, servings: 1, recipeId: null, productId: null, isFavourite: false, nutritionSource: nutrition.source, servingAssumption: `1 ${nutrition.packSize}${nutrition.packUnit} pack` },
    };
  }
  return null;
}

async function deterministicInterpret(text: string): Promise<AgentChatResult | null> {
  const water = text.match(/(?:water|drink|drank|log|add)[^\d]*(\d+(?:\.\d+)?)\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?)/i);
  if (water) {
    const amount = Number(water[1]) * (/^l|lit/i.test(water[2]) ? 1000 : 1);
    const proposal = await persistDraft({ kind: "water.add", summary: `Add ${Math.round(amount)} ml water to today's total`, payload: { date: today(), amountMl: Math.round(amount) } });
    return { message: "I’ve prepared a water entry. Check the amount, then confirm it.", followUpQuestions: [], proposals: [proposal], source: "deterministic" };
  }

  const bodyFat = text.match(/(?:body\s*fat)[^\d]*(\d+(?:\.\d+)?)\s*%/i);
  if (bodyFat) {
    const proposal = await persistDraft({ kind: "daily.update", summary: `Set today's body fat to ${bodyFat[1]}%`, payload: { date: today(), bodyFatPercent: Number(bodyFat[1]) } });
    return { message: "I’ve prepared the body-fat entry for review.", followUpQuestions: [], proposals: [proposal], source: "deterministic" };
  }

  const weight = text.match(/(?:weight|weigh)[^\d]*(\d+(?:\.\d+)?)\s*kg/i);
  if (weight) {
    const proposal = await persistDraft({ kind: "daily.update", summary: `Set today's weight to ${weight[1]} kg`, payload: { date: today(), weightKg: Number(weight[1]) } });
    return { message: "I’ve prepared the weight entry for review.", followUpQuestions: [], proposals: [proposal], source: "deterministic" };
  }

  const pantry = text.match(/(?:add|put)\s+(.+?)\s+(?:to|in)\s+(?:my\s+)?pantry/i);
  if (pantry) {
    const raw = pantry[1].trim();
    const parsed = raw.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.+)$/);
    const quantity = parsed ? Number(parsed[1]) : 1;
    const unit = parsed?.[2] ?? "item";
    const name = parsed?.[3] ?? raw;
    const proposal = await persistDraft({ kind: "pantry.add", summary: `Add ${quantity} ${unit} ${name} to pantry`, payload: { name, quantity, unit } });
    return { message: "I’ve prepared a pantry item. You can edit it before confirming.", followUpQuestions: [], proposals: [proposal], source: "deterministic" };
  }

  const note = text.match(/(?:note|remember)\s+(?:that\s+)?(.+)/i);
  if (note) {
    const proposal = await persistDraft({ kind: "daily.update", summary: "Add a note to today's log", payload: { date: today(), notes: note[1].trim() } });
    return { message: "I’ve prepared that note for today’s log.", followUpQuestions: [], proposals: [proposal], source: "deterministic" };
  }

  const activity = text.match(/(?:log|did|walked|ran|cycled|workout)[^\d]*(\d+)\s*(?:min|minute)/i);
  if (activity) {
    const workoutType = /run/i.test(text) ? "running" : /cycl/i.test(text) ? "cycling" : /walk/i.test(text) ? "walking" : "workout";
    const proposal = await persistDraft({ kind: "activity.add", summary: `Log ${activity[1]} minutes of ${workoutType}`, payload: { date: today(), workoutType, workoutDurationMin: Number(activity[1]), steps: 0, activeCalories: 0, sleepHours: 0, notes: null } });
    return { message: "I’ve prepared the activity entry. Missing step and calorie values remain zero rather than being invented.", followUpQuestions: [], proposals: [proposal], source: "deterministic" };
  }

  if (/\b(?:log|ate|had)\b/i.test(text)) {
    const draft = await foodDraft(text);
    if (draft) return { message: "I found a trusted nutrition match. Review the source and serving assumption before confirming.", followUpQuestions: [], proposals: [await persistDraft(draft)], source: "deterministic" };
    return { message: "I couldn’t find a trustworthy nutrition match, so I won’t invent calories or macros.", followUpQuestions: ["What was the exact food or recipe name and portion size?"], proposals: [], source: "deterministic" };
  }

  const favorite = text.match(/(?:save|favorite|favourite)\s+(.+?)(?:\s+recipe)?$/i);
  if (favorite) {
    const recipes = await db.select().from(recipesTable);
    const query = favorite[1].toLowerCase();
    const recipe = recipes.find((item) => item.name.toLowerCase().includes(query) || query.includes(item.name.toLowerCase()));
    if (recipe) return { message: "I found that recipe and prepared the favorite action.", followUpQuestions: [], proposals: [await persistDraft({ kind: "favorite.add", summary: `Add ${recipe.name} to Favorites`, payload: { recipeId: recipe.id, recipeName: recipe.name } })], source: "deterministic" };
  }

  const budget = text.match(/(?:weekly\s+)?budget[^\d]*(\d+(?:\.\d+)?)/i);
  if (budget && /(?:set|change|update)/i.test(text)) {
    return { message: "I’ve prepared the budget update.", followUpQuestions: [], proposals: [await persistDraft({ kind: "profile.update", summary: `Set weekly budget to R${budget[1]}`, payload: { budgetWeekly: Number(budget[1]) } })], source: "deterministic" };
  }

  const shop = text.match(/(?:create|start)\s+(?:a\s+)?(?:shop|basket)(?:\s+(?:called|named)\s+(.+))?/i);
  if (shop) {
    const name = shop[1]?.trim() || "My Shop";
    return { message: "I’ve prepared a new retailer shop.", followUpQuestions: [], proposals: [await persistDraft({ kind: "basket.create", summary: `Create retailer shop “${name}”`, payload: { name, mode: "cheapest" } })], source: "deterministic" };
  }
  const acceptPlan = text.match(/accept\s+(?:the\s+)?meal\s+plan(?:\s+with)?\s+recipes?\s+([\d,\s]+)/i);
  if (acceptPlan) {
    const recipeIds = acceptPlan[1].split(/[\s,]+/).map(Number).filter((value) => Number.isInteger(value) && value > 0);
    if (recipeIds.length > 0) return { message: "I’ve prepared the meal-plan acceptance and missing-ingredient shop.", followUpQuestions: [], proposals: [await persistDraft({ kind: "plan.accept", summary: `Accept meal plan with ${recipeIds.length} recipe${recipeIds.length === 1 ? "" : "s"}`, payload: { recipeIds, name: "Accepted Meal Plan Shopping List" } })], source: "deterministic" };
  }
  const addToShop = text.match(/add\s+(.+?)\s+to\s+(?:my\s+)?(?:latest\s+)?(?:shop|basket)/i);
  if (addToShop) {
    const [baskets, products] = await Promise.all([
      db.select().from(basketsTable).orderBy(desc(basketsTable.createdAt)).limit(1),
      db.select().from(productsTable),
    ]);
    const query = addToShop[1].toLowerCase();
    const product = products.find((item) => item.name.toLowerCase().includes(query) || query.includes(item.name.toLowerCase()));
    if (!baskets[0]) return { message: "Create a retailer shop first, then I can add products to it.", followUpQuestions: [], proposals: [], source: "deterministic" };
    if (!product) return { message: "I couldn’t find an exact retailer product match, so nothing was added.", followUpQuestions: ["What is the exact product name?"], proposals: [], source: "deterministic" };
    return { message: "I found the product and prepared it for your latest retailer shop.", followUpQuestions: [], proposals: [await persistDraft({ kind: "basket_item.add", summary: `Add ${product.name} to ${baskets[0].name}`, payload: { basketId: baskets[0].id, productId: product.id, productName: product.name, quantity: 1, unit: "pack" } })], source: "deterministic" };
  }
  return null;
}

function validateAiDraft(value: unknown): Draft | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.kind !== "string" || !ACTION_KINDS.has(raw.kind as AgentActionKind) || typeof raw.summary !== "string" || !raw.payload || typeof raw.payload !== "object") return null;
  if (["meal.add", "favorite.add", "plan.accept", "basket_item.add"].includes(raw.kind)) return null;
  return { kind: raw.kind as AgentActionKind, summary: raw.summary, payload: raw.payload as Record<string, unknown> };
}

async function openAiInterpret(messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<AgentChatResult | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const [profile, pantry] = await Promise.all([db.select().from(userProfileTable).limit(1), db.select().from(pantryItemsTable)]);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input: [{
        role: "system",
        content: `You are Nutri Agent. Reply as strict JSON with keys message, followUpQuestions, action. action is null unless a supported write is fully specified. Supported kinds: ${[...ACTION_KINDS].join(", ")}. Never invent nutrition, identifiers, prices, or missing health values. Ask a follow-up instead. Profile context: ${JSON.stringify(profile[0] ?? null)}. Pantry context: ${JSON.stringify(pantry.slice(0, 30))}.`,
      }, ...messages.slice(-8)],
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return null;
  const text = outputTextFromResponse(data);
  try {
    const parsed = JSON.parse(text) as { message?: unknown; followUpQuestions?: unknown; action?: unknown };
    const draft = validateAiDraft(parsed.action);
    return {
      message: typeof parsed.message === "string" ? parsed.message : "I can help with that.",
      followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions.filter((item): item is string => typeof item === "string") : [],
      proposals: draft ? [await persistDraft(draft)] : [],
      source: "openai",
    };
  } catch {
    return null;
  }
}

export async function chatWithAgent(messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<AgentChatResult> {
  const latest = [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
  if (!latest) return { message: "Type a request or choose a suggestion.", followUpQuestions: [], proposals: [], source: "deterministic" };
  const deterministic = await deterministicInterpret(latest);
  if (deterministic) return deterministic;
  const ai = await openAiInterpret(messages);
  if (ai) return ai;
  return {
    message: process.env.OPENAI_API_KEY
      ? "I couldn’t safely turn that into an app action. Try including the item, amount, date, or exact recipe name."
      : "OpenAI is unavailable, but I can still log water, weight, body fat, notes, pantry items, activities, exact recipes/products, favorites, and retailer shops.",
    followUpQuestions: ["What would you like to add, and what amount should I use?"],
    proposals: [],
    source: "deterministic",
  };
}

async function getOrCreateDaily(date: string) {
  const [existing] = await db.select().from(dailyLogsTable).where(eq(dailyLogsTable.date, date)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(dailyLogsTable).values({ date }).returning();
  return created;
}

async function executeAction(kind: AgentActionKind, payload: Record<string, unknown>) {
  if (kind === "water.add") {
    const date = String(payload.date ?? today());
    const daily = await getOrCreateDaily(date);
    const amountMl = Math.max(0, Math.round(numberFrom(payload.amountMl) ?? 0));
    const [updated] = await db.update(dailyLogsTable).set({ waterMl: daily.waterMl + amountMl }).where(eq(dailyLogsTable.id, daily.id)).returning();
    return { resource: "daily_log", id: updated.id, route: "/tracker", before: { waterMl: daily.waterMl }, after: { waterMl: updated.waterMl } };
  }
  if (kind === "daily.update") {
    const date = String(payload.date ?? today());
    const daily = await getOrCreateDaily(date);
    const patch: Record<string, unknown> = {};
    if (numberFrom(payload.weightKg) != null) patch.weightKg = numberFrom(payload.weightKg);
    if (numberFrom(payload.bodyFatPercent) != null) patch.bodyFatPercent = numberFrom(payload.bodyFatPercent);
    if (typeof payload.notes === "string") patch.notes = payload.notes;
    const [updated] = await db.update(dailyLogsTable).set(patch).where(eq(dailyLogsTable.id, daily.id)).returning();
    return { resource: "daily_log", id: updated.id, route: "/progress", before: daily, after: updated };
  }
  if (kind === "pantry.add") {
    const name = String(payload.name ?? "").trim();
    if (!name) throw new Error("Pantry item name is required");
    const [item] = await db.insert(pantryItemsTable).values({ name, quantity: numberFrom(payload.quantity) ?? 1, unit: String(payload.unit ?? "item"), category: String(payload.category ?? "other"), source: "manual", confirmed: true }).returning();
    return { resource: "pantry_item", id: item.id, route: "/pantry", after: item };
  }
  if (kind === "meal.add") {
    const required = ["name", "mealType", "calories", "proteinG", "carbsG", "fatG"];
    if (required.some((key) => payload[key] == null)) throw new Error("Meal nutrition is incomplete");
    const [meal] = await db.insert(mealEntriesTable).values({ date: String(payload.date ?? today()), mealType: String(payload.mealType), name: String(payload.name), calories: Math.round(numberFrom(payload.calories) ?? 0), proteinG: numberFrom(payload.proteinG) ?? 0, carbsG: numberFrom(payload.carbsG) ?? 0, fatG: numberFrom(payload.fatG) ?? 0, servings: numberFrom(payload.servings) ?? 1, recipeId: numberFrom(payload.recipeId), productId: numberFrom(payload.productId), isFavourite: payload.isFavourite === true }).returning();
    return { resource: "meal", id: meal.id, route: "/tracker", after: meal };
  }
  if (kind === "activity.add") {
    const [activity] = await db.insert(activityLogsTable).values({ date: String(payload.date ?? today()), steps: Math.round(numberFrom(payload.steps) ?? 0), activeCalories: Math.round(numberFrom(payload.activeCalories) ?? 0), workoutDurationMin: Math.round(numberFrom(payload.workoutDurationMin) ?? 0), workoutType: typeof payload.workoutType === "string" ? payload.workoutType : null, sleepHours: numberFrom(payload.sleepHours) ?? 0, notes: typeof payload.notes === "string" ? payload.notes : null }).returning();
    return { resource: "activity", id: activity.id, route: "/tracker/activity", after: activity };
  }
  if (kind === "profile.update") {
    const [profile] = await db.select().from(userProfileTable).limit(1);
    if (!profile) throw new Error("Complete onboarding before updating profile fields");
    const allowed = ["currentWeightKg", "heightCm", "targetWeightKg", "ageYears", "sex", "activityLevel", "bodyFatPercent", "dietPreference", "budgetWeekly", "mealFrequency", "retailerPreferences"];
    const patch = Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.includes(key)));
    const [updated] = await db.update(userProfileTable).set(patch).where(eq(userProfileTable.id, profile.id)).returning();
    return { resource: "profile", id: profile.id, route: "/settings", before: profile, after: updated };
  }
  if (kind === "favorite.add") {
    const recipeId = Math.round(numberFrom(payload.recipeId) ?? 0);
    const [existing] = await db.select().from(savedRecipesTable).where(eq(savedRecipesTable.recipeId, recipeId)).limit(1);
    const saved = existing ?? (await db.insert(savedRecipesTable).values({ recipeId }).returning())[0];
    return { resource: "favorite", id: saved.id, route: "/recipes", after: saved };
  }
  if (kind === "basket.create") {
    const [basket] = await db.insert(basketsTable).values({ name: String(payload.name ?? "My Shop"), mode: String(payload.mode ?? "cheapest") }).returning();
    return { resource: "basket", id: basket.id, route: `/basket/${basket.id}`, after: basket };
  }
  if (kind === "basket_item.add") {
    const basketId = Math.round(numberFrom(payload.basketId) ?? 0);
    const productId = Math.round(numberFrom(payload.productId) ?? 0);
    const [item] = await db.insert(basketItemsTable).values({ basketId, productId, quantity: numberFrom(payload.quantity) ?? 1, unit: String(payload.unit ?? "pack") }).returning();
    return { resource: "basket_item", id: item.id, route: `/basket/${basketId}`, after: item };
  }
  if (kind === "plan.accept") {
    const recipeIds = Array.isArray(payload.recipeIds) ? payload.recipeIds.map(numberFrom).filter((value): value is number => value != null).map(Math.round) : [];
    if (recipeIds.length === 0) throw new Error("No planned recipes were supplied");
    const pantry = await db.select().from(pantryItemsTable).where(eq(pantryItemsTable.confirmed, true));
    const basket = await createBasketFromRecipes({ recipeIds, name: String(payload.name ?? "Accepted Meal Plan Shopping List"), mode: "cheapest" }, { excludePantryItems: pantry.map((item) => item.name) });
    return { resource: "basket", id: basket?.id, route: basket ? `/basket/${basket.id}` : "/basket", after: basket };
  }
  throw new Error("Unsupported agent action");
}

export async function confirmAgentAction(id: number) {
  const [claimed] = await db.update(agentActionsTable).set({ status: "processing" }).where(and(eq(agentActionsTable.id, id), eq(agentActionsTable.status, "pending"))).returning();
  if (!claimed) {
    const [existing] = await db.select().from(agentActionsTable).where(eq(agentActionsTable.id, id)).limit(1);
    if (!existing) throw new Error("Agent action not found");
    return { action: publicAction(existing), status: existing.status, result: existing.result, duplicate: existing.status === "confirmed" };
  }
  if (claimed.expiresAt.getTime() < Date.now()) {
    await db.update(agentActionsTable).set({ status: "expired" }).where(eq(agentActionsTable.id, id));
    throw new Error("This action preview expired. Ask the agent to prepare it again.");
  }
  try {
    const result = await executeAction(claimed.kind as AgentActionKind, claimed.payload as Record<string, unknown>);
    const [confirmed] = await db.update(agentActionsTable).set({ status: "confirmed", confirmedAt: new Date(), result }).where(eq(agentActionsTable.id, id)).returning();
    return { action: publicAction(confirmed), status: confirmed.status, result, duplicate: false };
  } catch (error) {
    await db.update(agentActionsTable).set({ status: "failed", result: { error: error instanceof Error ? error.message : "Action failed" } }).where(eq(agentActionsTable.id, id));
    throw error;
  }
}

export async function dismissAgentAction(id: number) {
  const [action] = await db.update(agentActionsTable).set({ status: "dismissed" }).where(and(eq(agentActionsTable.id, id), eq(agentActionsTable.status, "pending"))).returning();
  if (!action) throw new Error("Only pending actions can be dismissed");
  return { action: publicAction(action), status: action.status };
}

export async function updateAgentAction(id: number, payload: Record<string, unknown>) {
  const [existing] = await db.select().from(agentActionsTable).where(and(eq(agentActionsTable.id, id), eq(agentActionsTable.status, "pending"))).limit(1);
  if (!existing) throw new Error("Only pending actions can be edited");
  validateDraftPayload(existing.kind as AgentActionKind, payload);
  const [action] = await db.update(agentActionsTable).set({ payload }).where(eq(agentActionsTable.id, id)).returning();
  return publicAction(action);
}

export async function undoAgentAction(id: number) {
  const [action] = await db.select().from(agentActionsTable).where(eq(agentActionsTable.id, id)).limit(1);
  if (!action || action.status !== "confirmed" || !action.result || typeof action.result !== "object") throw new Error("This action cannot be undone");
  const result = action.result as Record<string, unknown>;
  const resource = String(result.resource ?? "");
  const resourceId = Math.round(numberFrom(result.id) ?? 0);
  if (resource === "pantry_item") await db.delete(pantryItemsTable).where(eq(pantryItemsTable.id, resourceId));
  else if (resource === "meal") await db.delete(mealEntriesTable).where(eq(mealEntriesTable.id, resourceId));
  else if (resource === "activity") await db.delete(activityLogsTable).where(eq(activityLogsTable.id, resourceId));
  else if (resource === "favorite") await db.delete(savedRecipesTable).where(eq(savedRecipesTable.id, resourceId));
  else if (resource === "basket_item") await db.delete(basketItemsTable).where(eq(basketItemsTable.id, resourceId));
  else if (resource === "basket") {
    await db.delete(basketItemsTable).where(eq(basketItemsTable.basketId, resourceId));
    await db.delete(basketsTable).where(eq(basketsTable.id, resourceId));
  } else if (resource === "daily_log" && result.before && typeof result.before === "object") {
    const before = result.before as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if ("waterMl" in before) patch.waterMl = before.waterMl;
    if ("weightKg" in before) patch.weightKg = before.weightKg;
    if ("bodyFatPercent" in before) patch.bodyFatPercent = before.bodyFatPercent;
    if ("notes" in before) patch.notes = before.notes;
    await db.update(dailyLogsTable).set(patch).where(eq(dailyLogsTable.id, resourceId));
  } else if (resource === "profile" && result.before && typeof result.before === "object") {
    const before = result.before as typeof userProfileTable.$inferSelect;
    await db.update(userProfileTable).set(before).where(eq(userProfileTable.id, resourceId));
  } else throw new Error("This action cannot be undone automatically");
  await db.update(agentActionsTable).set({ status: "undone" }).where(eq(agentActionsTable.id, id));
  return { status: "undone", actionId: id };
}

export async function listRecentAgentActions() {
  return db.select().from(agentActionsTable).orderBy(desc(agentActionsTable.createdAt)).limit(20);
}
