import { pgTable, text, serial, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recipesTable = pgTable("recipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  prepTimeMin: integer("prep_time_min").notNull().default(0),
  cookTimeMin: integer("cook_time_min").notNull().default(0),
  servings: integer("servings").notNull().default(2),
  caloriesPerServing: integer("calories_per_serving").notNull(),
  proteinPerServingG: real("protein_per_serving_g").notNull(),
  carbsPerServingG: real("carbs_per_serving_g").notNull(),
  fatPerServingG: real("fat_per_serving_g").notNull(),
  fiberPerServingG: real("fiber_per_serving_g"),
  difficulty: text("difficulty").notNull().default("easy"), // easy | medium | hard
  tags: text("tags").array().notNull().default([]),
  estimatedCost: real("estimated_cost").notNull().default(0),
  imageUrl: text("image_url").notNull().default(""),
  instructions: text("instructions").array().notNull().default([]),
});

export const insertRecipeSchema = createInsertSchema(recipesTable).omit({ id: true });
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipesTable.$inferSelect;

export const recipeIngredientsTable = pgTable("recipe_ingredients", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => recipesTable.id),
  name: text("name").notNull(),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  calories: integer("calories").notNull().default(0),
  proteinG: real("protein_g").notNull().default(0),
  carbsG: real("carbs_g").notNull().default(0),
  fatG: real("fat_g").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull().default(0),
  productId: integer("product_id"),
  substitutes: text("substitutes").array().notNull().default([]),
});

export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredientsTable).omit({ id: true });
export type InsertRecipeIngredient = z.infer<typeof insertRecipeIngredientSchema>;
export type RecipeIngredient = typeof recipeIngredientsTable.$inferSelect;
