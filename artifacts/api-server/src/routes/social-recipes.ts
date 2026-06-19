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
import { parseId } from "../lib/request";
import { ensureRecipesSchema } from "../lib/schema-readiness";
import {
  buildSocialRecipeResponse,
  detectPlatform,
  extractRecipeWithAi,
  fetchPublicUrlContext,
  getNumber,
  getString,
  hasEnoughRecipeText,
  inferMealTypeFromText,
  socialIngredientAmountInPackUnit,
  matchIngredients,
  parseIngredients,
  parsePlatform,
} from "../services/social-recipe-service";

const router: IRouter = Router();

let socialRecipeSourcesSchemaReady: Promise<void> | null = null;

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

router.get("/social-recipes", async (_req, res): Promise<void> => {
  await ensureSocialRecipeSourcesSchema();
  const sources = await db.select().from(socialRecipeSourcesTable);
  const result = await Promise.all(sources.map(buildSocialRecipeResponse));
  res.json(result);
});

router.post("/social-recipes", async (req, res): Promise<void> => {
  await ensureSocialRecipeSourcesSchema();
  await ensureRecipesSchema();
  const sourceUrl = getString(req.body?.sourceUrl);
  const mediaDataUrls = Array.isArray(req.body?.mediaDataUrls)
    ? req.body.mediaDataUrls
        .map(getString)
        .filter((value: string) => /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value))
        .slice(0, 8)
    : [];
  let ingredientsText = getString(req.body?.ingredientsText);
  let caption = getString(req.body?.caption);
  let title = getString(req.body?.title);
  let creatorHandle = getString(req.body?.creatorHandle);
  let thumbnailUrl = getString(req.body?.thumbnailUrl);
  let extractedInstructions: string[] = [];
  const marketCode = (getString(req.body?.marketCode) || "ZA").toUpperCase();
  const platform = parsePlatform(req.body?.platform) !== "other" ? parsePlatform(req.body?.platform) : detectPlatform(sourceUrl);
  let servings = Math.max(1, Math.round(getNumber(req.body?.servings, 2)));

  if (!sourceUrl && mediaDataUrls.length === 0) {
    res.status(400).json({ error: "sourceUrl or uploaded recipe media is required" });
    return;
  }

  let aiExtractionUsed = false;
  let aiExtractionBlocked = false;
  const textIngredients = parseIngredients(ingredientsText || caption);
  const hasTextRecipe = hasEnoughRecipeText(ingredientsText || caption, textIngredients, Boolean(ingredientsText));
  const shouldUseAi = req.body?.autoExtract !== false && !hasTextRecipe && (mediaDataUrls.length > 0 || !ingredientsText || !title || !caption);
  const isUrlOnlyImport = !ingredientsText && !caption && mediaDataUrls.length === 0;
  if (shouldUseAi) {
    const context = sourceUrl ? await fetchPublicUrlContext(sourceUrl) : { title: "", description: "", imageUrl: "", text: "" };
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
        mediaDataUrls,
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
    res.status(400).json({
      error: "No real ingredients were visible in that post. TikTok often hides captions and video text from public scraping, so paste the caption or ingredient list to create the basket.",
    });
    return;
  }

  const matchedIngredients = await matchIngredients(parsedIngredients, marketCode);
  const totalCalories = matchedIngredients.reduce((sum, ingredient) => sum + ingredient.calories, 0);
  const totalProtein = matchedIngredients.reduce((sum, ingredient) => sum + ingredient.proteinG, 0);
  const totalCarbs = matchedIngredients.reduce((sum, ingredient) => sum + ingredient.carbsG, 0);
  const totalFat = matchedIngredients.reduce((sum, ingredient) => sum + ingredient.fatG, 0);
  const estimatedCost = matchedIngredients.reduce((sum, ingredient) => sum + ingredient.estimatedCost, 0);
  const hasUnmatched = matchedIngredients.some((ingredient) => !ingredient.productId);
  const mealType = inferMealTypeFromText(`${title} ${caption} ${ingredientsText}`);

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
      mealType,
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
      sourceUrl: sourceUrl || "uploaded-media",
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

  const ingredientMap = new Map<number, { productId: number; needed: number; product: typeof productsTable.$inferSelect }>();
  for (const ingredient of matched) {
    if (!ingredient.productId) continue;
    const product = (await db.select().from(productsTable).where(eq(productsTable.id, ingredient.productId)).limit(1))[0];
    if (!product) continue;
    const needed = socialIngredientAmountInPackUnit({
      raw: ingredient.name,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    }, product);
    const existing = ingredientMap.get(ingredient.productId);
    if (existing) {
      existing.needed += needed;
    } else {
      ingredientMap.set(ingredient.productId, {
        productId: ingredient.productId,
        needed,
        product,
      });
    }
  }

  for (const item of ingredientMap.values()) {
    const quantity = Math.max(1, Math.ceil(item.needed / Math.max(item.product.packSize, 0.001)));
    await db.insert(basketItemsTable).values({ basketId: basket.id, productId: item.productId, quantity, unit: "pack" });
  }

  res.status(201).json({
    basketId: basket.id,
    basketName: basket.name,
    itemCount: ingredientMap.size,
    unmatchedIngredients: ingredients.filter((ingredient) => ingredient.productId == null).map((ingredient) => ingredient.name),
  });
});

export default router;
