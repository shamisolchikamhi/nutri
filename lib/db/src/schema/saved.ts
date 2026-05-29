import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { recipesTable } from "./recipes";
import { productsTable } from "./products";

export const savedRecipesTable = pgTable("saved_recipes", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => recipesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSavedRecipeSchema = createInsertSchema(savedRecipesTable).omit({ id: true, createdAt: true });
export type InsertSavedRecipe = z.infer<typeof insertSavedRecipeSchema>;
export type SavedRecipe = typeof savedRecipesTable.$inferSelect;

export const savedSnacksTable = pgTable("saved_snacks", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSavedSnackSchema = createInsertSchema(savedSnacksTable).omit({ id: true, createdAt: true });
export type InsertSavedSnack = z.infer<typeof insertSavedSnackSchema>;
export type SavedSnack = typeof savedSnacksTable.$inferSelect;
