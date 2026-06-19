import { productsTable } from "@workspace/db";

type IngredientAmount = { name: string; quantity: number; unit: string };
type Product = typeof productsTable.$inferSelect;

const STOP_WORDS = new Set(["fresh", "free", "range", "skinless", "boneless", "smooth", "organic", "woolworths", "pnp", "checkers"]);

export function normalizeIngredientTokens(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function productPackGrams(product: Product) {
  if (product.packUnit === "kg" || product.packUnit === "l") return product.packSize * 1000;
  if (product.packUnit === "g" || product.packUnit === "ml") return product.packSize;
  return Math.max(1, product.packSize) * 100;
}

export function ingredientAmountInPackUnit(ingredient: IngredientAmount, product: Product, estimateGrams?: (ingredient: IngredientAmount) => number) {
  if ((ingredient.unit === "g" || ingredient.unit === "kg") && product.packUnit === "kg") return ingredient.unit === "kg" ? ingredient.quantity : ingredient.quantity / 1000;
  if ((ingredient.unit === "g" || ingredient.unit === "kg") && product.packUnit === "g") return ingredient.unit === "kg" ? ingredient.quantity * 1000 : ingredient.quantity;
  if ((ingredient.unit === "ml" || ingredient.unit === "l") && product.packUnit === "l") return ingredient.unit === "l" ? ingredient.quantity : ingredient.quantity / 1000;
  if ((ingredient.unit === "ml" || ingredient.unit === "l") && product.packUnit === "ml") return ingredient.unit === "l" ? ingredient.quantity * 1000 : ingredient.quantity;
  if (estimateGrams && (product.packUnit === "g" || product.packUnit === "kg") && !["unit", "each"].includes(ingredient.unit)) {
    const grams = estimateGrams(ingredient);
    return product.packUnit === "kg" ? grams / 1000 : grams;
  }
  return ingredient.quantity;
}

export function basketQuantityForIngredient(ingredient: IngredientAmount, product: Product, estimateGrams?: (ingredient: IngredientAmount) => number) {
  const needed = ingredientAmountInPackUnit(ingredient, product, estimateGrams);
  return Math.max(1, Math.ceil(needed / Math.max(product.packSize, 0.001)));
}

export function scoreProductForIngredient(ingredientName: string, product: Product, options: { exact?: number; contains?: number; special?: number; price?: number } = {}) {
  const ingredientTokens = normalizeIngredientTokens(ingredientName);
  const productTokens = normalizeIngredientTokens(`${product.brand ?? ""} ${product.name}`);
  const productSet = new Set(productTokens);
  let score = 0;
  for (const token of ingredientTokens) {
    if (productSet.has(token)) score += options.exact ?? 5;
    else if (productTokens.some((candidate) => candidate.includes(token) || token.includes(candidate))) score += 2;
  }
  if (product.name.toLowerCase().includes(ingredientName.toLowerCase())) score += options.contains ?? 6;
  if (product.category !== "other") score += 1;
  if (product.isOnSpecial) score += options.special ?? 0;
  if (product.priceAud > 0 && options.price) score += Math.max(0, options.price - product.priceAud / 250);
  return score;
}
