import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pantryItemsTable, recipeIngredientsTable, recipesTable } from "@workspace/db";
import { parseId } from "../lib/request";

const router: IRouter = Router();

const EXPIRY_BY_CATEGORY: Record<string, number> = {
  dairy: 7,
  fruit_veg: 5,
  protein: 3,
  bakery: 4,
  pantry: 60,
  frozen: 90,
  other: 14,
};

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inferCategory(name: string): string {
  const lower = name.toLowerCase();
  if (/(milk|yoghurt|yogurt|cheese|cream|butter)/.test(lower)) return "dairy";
  if (/(apple|banana|broccoli|spinach|tomato|onion|potato|carrot|lettuce|pepper|berry|berries|avocado)/.test(lower)) return "fruit_veg";
  if (/(chicken|beef|fish|tuna|egg|eggs|pork|turkey|tofu)/.test(lower)) return "protein";
  if (/(bread|roll|wrap|tortilla|bagel)/.test(lower)) return "bakery";
  if (/(rice|oats|pasta|flour|beans|lentils|oil|sauce|spice|cereal)/.test(lower)) return "pantry";
  if (/(frozen|ice cream)/.test(lower)) return "frozen";
  return "other";
}

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeName(raw: string): string {
  return raw
    .replace(/\b(each|ea|total|subtotal|visa|mastercard|cash|change|tax|vat)\b/gi, "")
    .replace(/[$R]\s?\d+(?:[.,]\d{2})?/g, "")
    .replace(/\d+(?:[.,]\d{2})?\s?(kg|g|ml|l)\b/gi, "")
    .replace(/[^a-zA-Z0-9 '&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCaptureText(rawText: string, source = "receipt") {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2)
    .map((line) => {
      const explicitDate = line.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1] ?? null;
      const quantityMatch = line.match(/\b(\d+(?:[.,]\d+)?)\s?(x|kg|g|ml|l|pack|packs|item|items)?\b/i);
      const quantity = quantityMatch ? Number(quantityMatch[1].replace(",", ".")) : 1;
      const unit = quantityMatch?.[2]?.toLowerCase() ?? "item";
      const name = normalizeName(line);
      if (!name || name.length < 3) return null;
      const category = inferCategory(name);
      return {
        name,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unit,
        category,
        source,
        expiresOn: explicitDate ?? addDays(EXPIRY_BY_CATEGORY[category] ?? EXPIRY_BY_CATEGORY.other),
        confirmed: false,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 30);
}

function buildPantryItem(item: typeof pantryItemsTable.$inferSelect) {
  return {
    ...item,
    capturedAt: item.capturedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function extractPantryWithAi(mediaDataUrls: string[]) {
  if (!process.env.OPENAI_API_KEY || mediaDataUrls.length === 0) return "";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: "Extract grocery pantry or receipt line items from images. Return one item per line with quantity if visible. Do not invent items.",
        },
        {
          role: "user",
          content: mediaDataUrls.slice(0, 6).map((image_url) => ({ type: "input_image", image_url })),
        },
      ],
    }),
  });
  const data = await response.json().catch(() => null) as { output_text?: string } | null;
  if (!response.ok) throw new Error("OpenAI pantry capture failed");
  return getString(data?.output_text);
}

router.get("/pantry/items", async (_req, res): Promise<void> => {
  const items = await db.select().from(pantryItemsTable);
  res.json(items.map(buildPantryItem).sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999")));
});

router.post("/pantry/capture", async (req, res): Promise<void> => {
  const source = getString(req.body?.source) || "receipt";
  const mediaDataUrls = Array.isArray(req.body?.mediaDataUrls)
    ? req.body.mediaDataUrls.filter((value: unknown): value is string => typeof value === "string" && value.startsWith("data:image/"))
    : [];
  let rawText = getString(req.body?.rawText);
  if (!rawText && mediaDataUrls.length > 0) rawText = await extractPantryWithAi(mediaDataUrls);
  if (!rawText) {
    res.status(400).json({ error: "Paste receipt or pantry text, or start the real API with OPENAI_API_KEY to analyze uploaded photos." });
    return;
  }

  const parsed = parseCaptureText(rawText, source);
  if (parsed.length === 0) {
    res.status(400).json({ error: "No grocery items were found. Add one item per line and try again." });
    return;
  }
  const inserted = await db.insert(pantryItemsTable).values(parsed).returning();
  res.status(201).json({ items: inserted.map(buildPantryItem), suggestedMeals: await pantrySuggestions(inserted.map((item) => item.name)) });
});

router.post("/pantry/items", async (req, res): Promise<void> => {
  const name = getString(req.body?.name);
  if (!name) {
    res.status(400).json({ error: "Item name is required" });
    return;
  }
  const [item] = await db.insert(pantryItemsTable).values({
    name,
    quantity: Number(req.body?.quantity) || 1,
    unit: getString(req.body?.unit) || "item",
    category: getString(req.body?.category) || inferCategory(name),
    source: "manual",
    expiresOn: getString(req.body?.expiresOn) || addDays(EXPIRY_BY_CATEGORY[inferCategory(name)] ?? EXPIRY_BY_CATEGORY.other),
    confirmed: true,
  }).returning();
  res.status(201).json(buildPantryItem(item));
});

router.put("/pantry/items/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [item] = await db.update(pantryItemsTable).set({
    name: getString(req.body?.name),
    quantity: Number(req.body?.quantity) || 1,
    unit: getString(req.body?.unit) || "item",
    category: getString(req.body?.category) || "other",
    expiresOn: getString(req.body?.expiresOn) || null,
    confirmed: req.body?.confirmed === true,
  }).where(eq(pantryItemsTable.id, id)).returning();
  if (!item) {
    res.status(404).json({ error: "Pantry item not found" });
    return;
  }
  res.json(buildPantryItem(item));
});

router.delete("/pantry/items/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(pantryItemsTable).where(eq(pantryItemsTable.id, id));
  res.status(204).end();
});

async function pantrySuggestions(itemNames: string[]) {
  const [recipes, ingredients] = await Promise.all([
    db.select().from(recipesTable),
    db.select().from(recipeIngredientsTable),
  ]);
  const tokens = itemNames.map((name) => name.toLowerCase());
  return recipes
    .map((recipe) => {
      const recipeIngredients = ingredients.filter((ingredient) => ingredient.recipeId === recipe.id);
      const matchedPantryItems = recipeIngredients
        .filter((ingredient) => tokens.some((token) => ingredient.name.toLowerCase().includes(token) || token.includes(ingredient.name.toLowerCase())))
        .map((ingredient) => ingredient.name);
      return {
        recipeId: recipe.id,
        name: recipe.name,
        matchedPantryItems: [...new Set(matchedPantryItems)],
        reason: matchedPantryItems.length
          ? `Uses ${matchedPantryItems.slice(0, 3).join(", ")} before it expires.`
          : "No pantry overlap yet.",
      };
    })
    .filter((suggestion) => suggestion.matchedPantryItems.length > 0)
    .sort((a, b) => b.matchedPantryItems.length - a.matchedPantryItems.length)
    .slice(0, 4);
}

router.get("/pantry/suggestions", async (_req, res): Promise<void> => {
  const items = await db.select().from(pantryItemsTable);
  res.json(await pantrySuggestions(items.map((item) => item.name)));
});

export default router;
