import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  basketsTable,
  basketItemsTable,
  productsTable,
  retailersTable,
  recipeIngredientsTable,
  recipesTable,
  socialRecipeSourcesTable,
} from "@workspace/db";

const router: IRouter = Router();

let socialRecipeSourcesSchemaReady: Promise<void> | null = null;

type Platform = "tiktok" | "instagram" | "facebook" | "other";

type ParsedIngredient = {
  raw: string;
  name: string;
  quantity: number;
  unit: string;
};

type MatchedIngredient = ParsedIngredient & {
  productId: number | null;
  productName: string | null;
  retailerName: string | null;
  score: number;
  estimatedCost: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type ExtractedRecipe = {
  title: string;
  creatorHandle: string | null;
  caption: string;
  ingredients: ParsedIngredient[];
  instructions: string[];
  servings: number;
  thumbnailUrl: string;
};

type PublicUrlContext = {
  title: string;
  description: string;
  imageUrl: string;
  text: string;
};

function ensureSocialRecipeSourcesSchema() {
  socialRecipeSourcesSchemaReady ??= (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS social_recipe_sources (
        id serial PRIMARY KEY,
        platform text NOT NULL,
        source_url text NOT NULL,
        creator_handle text,
        title text NOT NULL,
        caption text NOT NULL DEFAULT '',
        ingredients_text text NOT NULL DEFAULT '',
        thumbnail_url text NOT NULL DEFAULT '',
        market_code text NOT NULL DEFAULT 'ZA',
        imported_recipe_id integer,
        status text NOT NULL DEFAULT 'imported',
        created_at timestamp with time zone NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`ALTER TABLE social_recipe_sources ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'other'`);
    await db.execute(sql`ALTER TABLE social_recipe_sources ADD COLUMN IF NOT EXISTS source_url text NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE social_recipe_sources ADD COLUMN IF NOT EXISTS creator_handle text`);
    await db.execute(sql`ALTER TABLE social_recipe_sources ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Social recipe'`);
    await db.execute(sql`ALTER TABLE social_recipe_sources ADD COLUMN IF NOT EXISTS caption text NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE social_recipe_sources ADD COLUMN IF NOT EXISTS ingredients_text text NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE social_recipe_sources ADD COLUMN IF NOT EXISTS thumbnail_url text NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE social_recipe_sources ADD COLUMN IF NOT EXISTS market_code text NOT NULL DEFAULT 'ZA'`);
    await db.execute(sql`ALTER TABLE social_recipe_sources ADD COLUMN IF NOT EXISTS imported_recipe_id integer`);
    await db.execute(sql`ALTER TABLE social_recipe_sources ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'imported'`);
    await db.execute(sql`ALTER TABLE social_recipe_sources ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now()`);
  })().catch((error) => {
    socialRecipeSourcesSchemaReady = null;
    throw error;
  });

  return socialRecipeSourcesSchemaReady;
}

const UNIT_WORDS = new Set([
  "g",
  "gram",
  "grams",
  "kg",
  "ml",
  "l",
  "litre",
  "litres",
  "cup",
  "cups",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "tsp",
  "teaspoon",
  "teaspoons",
  "can",
  "cans",
  "tin",
  "tins",
  "packet",
  "packets",
  "slice",
  "slices",
]);

const STOP_WORDS = new Set([
  "fresh",
  "chopped",
  "diced",
  "sliced",
  "optional",
  "cooked",
  "raw",
  "large",
  "small",
  "medium",
  "low",
  "fat",
  "free",
  "and",
  "or",
  "with",
  "of",
]);

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getOptionalString(value: unknown): string | null {
  const text = getString(value);
  return text ? text : null;
}

function parsePlatform(value: unknown): Platform {
  const platform = getString(value).toLowerCase();
  if (platform === "tiktok" || platform === "instagram" || platform === "facebook") return platform;
  return "other";
}

function parseId(raw: unknown): number {
  return parseInt(Array.isArray(raw) ? raw[0] : String(raw), 10);
}

function detectPlatform(url: string): Platform {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("instagram")) return "instagram";
    if (host.includes("facebook") || host.includes("fb.watch")) return "facebook";
  } catch {
    return "other";
  }
  return "other";
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeToken(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token) && !UNIT_WORDS.has(token));
}

function parseQuantity(raw: string) {
  const fraction = raw.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const top = Number.parseFloat(fraction[1]);
    const bottom = Number.parseFloat(fraction[2]);
    return bottom > 0 ? top / bottom : 1;
  }
  const mixed = raw.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number.parseFloat(mixed[1]);
    const top = Number.parseFloat(mixed[2]);
    const bottom = Number.parseFloat(mixed[3]);
    return bottom > 0 ? whole + top / bottom : whole;
  }
  const parsed = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function cleanIngredientName(value: string) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/[-•*]/g, " ")
    .replace(/\b(to taste|for serving|as needed)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIngredientLine(rawLine: string): ParsedIngredient | null {
  const raw = rawLine.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim();
  if (!raw || raw.length < 3) return null;

  const match = raw.match(/^((?:\d+\s+\d+\/\d+)|(?:\d+\/\d+)|(?:\d+(?:[.,]\d+)?))?\s*([a-zA-Z]+)?\s+(.+)$/);
  const quantity = match?.[1] ? parseQuantity(match[1]) : 1;
  const unitCandidate = match?.[2]?.toLowerCase() ?? "";
  const unit = UNIT_WORDS.has(unitCandidate) ? unitCandidate : "unit";
  const nameSource = unit === "unit" ? raw.replace(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s+/, "") : match?.[3] ?? raw;
  const name = cleanIngredientName(nameSource);

  if (!name || tokenize(name).length === 0) return null;
  return { raw, name, quantity, unit };
}

function parseIngredients(text: string): ParsedIngredient[] {
  return text
    .split(/\r?\n|;/)
    .map(parseIngredientLine)
    .filter((ingredient): ingredient is ParsedIngredient => Boolean(ingredient))
    .slice(0, 30);
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return html.match(pattern)?.[1]?.trim() ?? "";
}

async function fetchPublicUrlContext(sourceUrl: string): Promise<PublicUrlContext> {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "NutriBasket/0.1 recipe importer",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { title: "", description: "", imageUrl: "", text: "" };
    }

    const html = await response.text();
    const title = extractMeta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
    const description = extractMeta(html, "og:description") || extractMeta(html, "description");
    const imageUrl = extractMeta(html, "og:image");
    return {
      title: stripHtml(title).slice(0, 180),
      description: stripHtml(description).slice(0, 1000),
      imageUrl,
      text: stripHtml(html).slice(0, 12_000),
    };
  } catch {
    return { title: "", description: "", imageUrl: "", text: "" };
  }
}

function outputTextFromResponse(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const direct = (data as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;

  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.join("\n");
}

function coerceExtractedIngredient(value: unknown): ParsedIngredient | null {
  if (!value || typeof value !== "object") return null;
  const raw = getString((value as Record<string, unknown>).raw);
  const name = cleanIngredientName(getString((value as Record<string, unknown>).name));
  const unit = getString((value as Record<string, unknown>).unit) || "unit";
  const quantity = getNumber((value as Record<string, unknown>).quantity, 1);
  if (!name || tokenize(name).length === 0) return null;
  return {
    raw: raw || `${quantity} ${unit} ${name}`.trim(),
    name,
    quantity: Math.max(0.01, quantity),
    unit: unit.toLowerCase(),
  };
}

function coerceExtractedRecipe(value: unknown): ExtractedRecipe | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const ingredients = Array.isArray(record.ingredients)
    ? record.ingredients.map(coerceExtractedIngredient).filter((item): item is ParsedIngredient => Boolean(item))
    : [];
  if (ingredients.length === 0) return null;

  return {
    title: getString(record.title) || "Social recipe",
    creatorHandle: getOptionalString(record.creatorHandle),
    caption: getString(record.caption),
    ingredients,
    instructions: Array.isArray(record.instructions)
      ? record.instructions.map(getString).filter(Boolean).slice(0, 12)
      : [],
    servings: Math.max(1, Math.round(getNumber(record.servings, 2))),
    thumbnailUrl: getString(record.thumbnailUrl),
  };
}

async function extractRecipeWithAi(input: {
  sourceUrl: string;
  platform: Platform;
  title: string;
  caption: string;
  ingredientsText: string;
  creatorHandle: string;
  servings: number;
  thumbnailUrl: string;
  context: PublicUrlContext;
}): Promise<ExtractedRecipe | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        input: [
          {
            role: "system",
            content:
              "Extract a grocery-basket-ready recipe from social media recipe context. " +
              "Only use information present in the URL metadata, caption, provided notes, or visible page text. " +
              "Return concise ingredient names that can be matched to grocery products. Do not invent ingredients.",
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "social_recipe_extraction",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["title", "creatorHandle", "caption", "ingredients", "instructions", "servings", "thumbnailUrl"],
              properties: {
                title: { type: "string" },
                creatorHandle: { type: ["string", "null"] },
                caption: { type: "string" },
                servings: { type: "integer", minimum: 1 },
                thumbnailUrl: { type: "string" },
                ingredients: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["raw", "name", "quantity", "unit"],
                    properties: {
                      raw: { type: "string" },
                      name: { type: "string" },
                      quantity: { type: "number" },
                      unit: { type: "string" },
                    },
                  },
                },
                instructions: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
        },
      }),
    });
  } catch (error) {
    throw new Error(`AI recipe extraction could not reach OpenAI: ${error instanceof Error ? error.message : "network request failed"}`);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object"
      ? getString((data as { error?: { message?: unknown } }).error?.message)
      : "";
    throw new Error(`AI recipe extraction failed with ${response.status}${message ? `: ${message}` : ""}`);
  }

  const text = outputTextFromResponse(data);
  if (!text) return null;
  return coerceExtractedRecipe(JSON.parse(text));
}

function estimateGrams(ingredient: ParsedIngredient, product: typeof productsTable.$inferSelect) {
  if (ingredient.unit === "kg") return ingredient.quantity * 1000;
  if (ingredient.unit === "g") return ingredient.quantity;
  if (ingredient.unit === "l") return ingredient.quantity * 1000;
  if (ingredient.unit === "ml") return ingredient.quantity;
  if (ingredient.unit === "cup" || ingredient.unit === "cups") return ingredient.quantity * 150;
  if (ingredient.unit === "tbsp" || ingredient.unit.startsWith("tablespoon")) return ingredient.quantity * 15;
  if (ingredient.unit === "tsp" || ingredient.unit.startsWith("teaspoon")) return ingredient.quantity * 5;
  if (ingredient.unit === "can" || ingredient.unit === "cans" || ingredient.unit === "tin" || ingredient.unit === "tins") return ingredient.quantity * 400;
  if (product.packUnit === "kg") return Math.max(50, ingredient.quantity * product.packSize * 1000);
  if (product.packUnit === "l") return Math.max(50, ingredient.quantity * product.packSize * 1000);
  return ingredient.quantity * 100;
}

function basketQuantityFor(ingredient: ParsedIngredient, product: typeof productsTable.$inferSelect) {
  if ((ingredient.unit === "g" || ingredient.unit === "kg") && product.packUnit === "kg") {
    const kg = ingredient.unit === "kg" ? ingredient.quantity : ingredient.quantity / 1000;
    return Math.max(1, Math.ceil(kg / Math.max(product.packSize, 0.001)));
  }
  if ((ingredient.unit === "ml" || ingredient.unit === "l") && product.packUnit === "l") {
    const litres = ingredient.unit === "l" ? ingredient.quantity : ingredient.quantity / 1000;
    return Math.max(1, Math.ceil(litres / Math.max(product.packSize, 0.001)));
  }
  return Math.max(1, Math.ceil(ingredient.quantity));
}

async function getMarketProducts(marketCode: string) {
  const retailers = await db.select().from(retailersTable).where(eq(retailersTable.marketCode, marketCode));
  const retailerIds = new Set(retailers.map((retailer) => retailer.id));
  const retailerNames = new Map(retailers.map((retailer) => [retailer.id, retailer.name]));
  const products = await db.select().from(productsTable);
  return {
    products: products.filter((product) => retailerIds.has(product.retailerId)),
    retailerNames,
  };
}

function scoreProduct(ingredient: ParsedIngredient, product: typeof productsTable.$inferSelect) {
  const ingredientTokens = tokenize(ingredient.name);
  const productTokens = tokenize(`${product.brand ?? ""} ${product.name}`);
  const productTokenSet = new Set(productTokens);
  let score = 0;

  for (const token of ingredientTokens) {
    if (productTokenSet.has(token)) score += 4;
    else if (productTokens.some((candidate) => candidate.includes(token) || token.includes(candidate))) score += 2;
  }

  if (normalizeToken(product.name).includes(normalizeToken(ingredient.name))) score += 5;
  if (product.isOnSpecial) score += 1;
  if (product.priceAud > 0) score += Math.max(0, 1 - product.priceAud / 250);
  return score;
}

async function matchIngredients(ingredients: ParsedIngredient[], marketCode: string): Promise<MatchedIngredient[]> {
  const { products, retailerNames } = await getMarketProducts(marketCode);

  return ingredients.map((ingredient) => {
    const ranked = products
      .map((product) => ({ product, score: scoreProduct(ingredient, product) }))
      .filter((item) => item.score >= 4)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.product.priceAud - b.product.priceAud;
      });
    const best = ranked[0]?.product;
    if (!best) {
      return {
        ...ingredient,
        productId: null,
        productName: null,
        retailerName: null,
        score: 0,
        estimatedCost: 0,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      };
    }

    const grams = estimateGrams(ingredient, best);
    const packs = basketQuantityFor(ingredient, best);
    return {
      ...ingredient,
      quantity: packs,
      unit: "unit",
      productId: best.id,
      productName: best.name,
      retailerName: retailerNames.get(best.retailerId) ?? "Unknown",
      score: ranked[0].score,
      estimatedCost: Math.round(best.priceAud * packs * 100) / 100,
      calories: Math.round((best.caloriesPer100g * grams) / 100),
      proteinG: Math.round((best.proteinPer100g * grams) / 100 * 10) / 10,
      carbsG: Math.round((best.carbsPer100g * grams) / 100 * 10) / 10,
      fatG: Math.round((best.fatPer100g * grams) / 100 * 10) / 10,
    };
  });
}

async function buildSocialRecipeResponse(source: typeof socialRecipeSourcesTable.$inferSelect) {
  const recipe = source.importedRecipeId
    ? (await db.select().from(recipesTable).where(eq(recipesTable.id, source.importedRecipeId)).limit(1))[0]
    : null;
  const ingredients = source.importedRecipeId
    ? await db.select().from(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, source.importedRecipeId))
    : [];

  return {
    ...source,
    createdAt: source.createdAt.toISOString(),
    recipe,
    ingredients,
    matchedCount: ingredients.filter((ingredient) => ingredient.productId != null).length,
    unmatchedIngredients: ingredients.filter((ingredient) => ingredient.productId == null).map((ingredient) => ingredient.name),
  };
}

router.get("/social-recipes", async (_req, res): Promise<void> => {
  await ensureSocialRecipeSourcesSchema();
  const sources = await db.select().from(socialRecipeSourcesTable);
  const result = await Promise.all(sources.map(buildSocialRecipeResponse));
  res.json(result);
});

router.post("/social-recipes", async (req, res): Promise<void> => {
  await ensureSocialRecipeSourcesSchema();
  const sourceUrl = getString(req.body?.sourceUrl);
  let ingredientsText = getString(req.body?.ingredientsText);
  let caption = getString(req.body?.caption);
  let title = getString(req.body?.title);
  let creatorHandle = getString(req.body?.creatorHandle);
  let thumbnailUrl = getString(req.body?.thumbnailUrl);
  let extractedInstructions: string[] = [];
  const marketCode = (getString(req.body?.marketCode) || "ZA").toUpperCase();
  const platform = parsePlatform(req.body?.platform) !== "other" ? parsePlatform(req.body?.platform) : detectPlatform(sourceUrl);
  let servings = Math.max(1, Math.round(getNumber(req.body?.servings, 2)));

  if (!sourceUrl) {
    res.status(400).json({ error: "sourceUrl is required" });
    return;
  }

  let aiExtractionUsed = false;
  let aiExtractionBlocked = false;
  const shouldUseAi = req.body?.autoExtract !== false && (!ingredientsText || !title || !caption);
  const isUrlOnlyImport = !ingredientsText && !caption;
  if (shouldUseAi) {
    const context = await fetchPublicUrlContext(sourceUrl);
    try {
      const extracted = await extractRecipeWithAi({
        sourceUrl,
        platform,
        title,
        caption,
        ingredientsText,
        creatorHandle,
        servings,
        thumbnailUrl,
        context,
      });
      if (extracted) {
        aiExtractionUsed = true;
        title ||= extracted.title || context.title;
        creatorHandle ||= extracted.creatorHandle ?? "";
        caption ||= extracted.caption || context.description;
        thumbnailUrl ||= extracted.thumbnailUrl || context.imageUrl;
        servings = Math.max(1, Math.round(getNumber(req.body?.servings, extracted.servings)));
        extractedInstructions = extracted.instructions;
        if (!ingredientsText) {
          ingredientsText = extracted.ingredients
            .map((ingredient) => ingredient.raw || `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`)
            .join("\n");
        }
      } else if (!process.env.OPENAI_API_KEY) {
        aiExtractionBlocked = true;
        title ||= context.title;
        caption ||= context.description;
        thumbnailUrl ||= context.imageUrl;
      }
    } catch (error) {
      if (!ingredientsText && !caption) {
        res.status(503).json({ error: error instanceof Error ? error.message : "AI recipe extraction failed" });
        return;
      }
    }
  }

  if (!title) title = "Social recipe";
  if (!ingredientsText && !caption) {
    res.status(400).json({
      error: aiExtractionBlocked || isUrlOnlyImport
        ? "OPENAI_API_KEY is required to import from URL only. Add an API key or paste the recipe ingredients."
        : "No recipe ingredients were found. Paste ingredient text or try a public post with visible recipe details.",
    });
    return;
  }

  const parsedIngredients = parseIngredients(ingredientsText || caption);
  if (parsedIngredients.length === 0) {
    res.status(400).json({ error: "No usable ingredients were found" });
    return;
  }

  const matchedIngredients = await matchIngredients(parsedIngredients, marketCode);
  const totalCalories = matchedIngredients.reduce((sum, ingredient) => sum + ingredient.calories, 0);
  const totalProtein = matchedIngredients.reduce((sum, ingredient) => sum + ingredient.proteinG, 0);
  const totalCarbs = matchedIngredients.reduce((sum, ingredient) => sum + ingredient.carbsG, 0);
  const totalFat = matchedIngredients.reduce((sum, ingredient) => sum + ingredient.fatG, 0);
  const estimatedCost = matchedIngredients.reduce((sum, ingredient) => sum + ingredient.estimatedCost, 0);
  const hasUnmatched = matchedIngredients.some((ingredient) => !ingredient.productId);

  const [recipe] = await db
    .insert(recipesTable)
    .values({
      name: title,
      description: caption || `Imported from ${platform}`,
      prepTimeMin: 0,
      cookTimeMin: 0,
      servings,
      caloriesPerServing: Math.round(totalCalories / servings),
      proteinPerServingG: Math.round(totalProtein / servings * 10) / 10,
      carbsPerServingG: Math.round(totalCarbs / servings * 10) / 10,
      fatPerServingG: Math.round(totalFat / servings * 10) / 10,
      fiberPerServingG: null,
      difficulty: "easy",
      tags: ["social", platform, hasUnmatched ? "needs_review" : "basket_ready"],
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      imageUrl: thumbnailUrl,
      instructions: extractedInstructions.length > 0 ? extractedInstructions : caption ? caption.split(/\r?\n/).filter(Boolean).slice(0, 8) : [],
    })
    .returning();

  for (const ingredient of matchedIngredients) {
    await db.insert(recipeIngredientsTable).values({
      recipeId: recipe.id,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      calories: ingredient.calories,
      proteinG: ingredient.proteinG,
      carbsG: ingredient.carbsG,
      fatG: ingredient.fatG,
      estimatedCost: ingredient.estimatedCost,
      productId: ingredient.productId,
      substitutes: [],
    });
  }

  const [source] = await db
    .insert(socialRecipeSourcesTable)
    .values({
      platform,
      sourceUrl,
      creatorHandle: creatorHandle || null,
      title,
      caption,
      ingredientsText,
      thumbnailUrl,
      marketCode,
      importedRecipeId: recipe.id,
      status: hasUnmatched ? "needs_review" : "imported",
    })
    .returning();

  res.status(201).json({
    ...(await buildSocialRecipeResponse(source)),
    matches: matchedIngredients,
    aiExtractionUsed,
  });
});

router.post("/social-recipes/:id/basket", async (req, res): Promise<void> => {
  await ensureSocialRecipeSourcesSchema();
  const id = parseId(req.params.id);
  const sources = await db.select().from(socialRecipeSourcesTable).where(eq(socialRecipeSourcesTable.id, id)).limit(1);
  const source = sources[0];
  if (!source?.importedRecipeId) {
    res.status(404).json({ error: "Social recipe not found" });
    return;
  }

  const ingredients = await db
    .select()
    .from(recipeIngredientsTable)
    .where(eq(recipeIngredientsTable.recipeId, source.importedRecipeId));
  const matched = ingredients.filter((ingredient) => ingredient.productId != null);
  if (matched.length === 0) {
    res.status(400).json({ error: "No matched local-store ingredients are available for this recipe" });
    return;
  }

  const [basket] = await db
    .insert(basketsTable)
    .values({
      name: getString(req.body?.name) || `${source.title} Basket`,
      mode: getString(req.body?.mode) || "cheapest",
    })
    .returning();

  const ingredientMap = new Map<number, { productId: number; quantity: number; unit: string }>();
  for (const ingredient of matched) {
    if (!ingredient.productId) continue;
    const existing = ingredientMap.get(ingredient.productId);
    if (existing) {
      existing.quantity += ingredient.quantity;
    } else {
      ingredientMap.set(ingredient.productId, {
        productId: ingredient.productId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      });
    }
  }

  for (const item of ingredientMap.values()) {
    await db.insert(basketItemsTable).values({ basketId: basket.id, ...item });
  }

  res.status(201).json({
    basketId: basket.id,
    basketName: basket.name,
    itemCount: ingredientMap.size,
    unmatchedIngredients: ingredients.filter((ingredient) => ingredient.productId == null).map((ingredient) => ingredient.name),
  });
});

export default router;
