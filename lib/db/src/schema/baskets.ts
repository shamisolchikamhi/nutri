import { pgTable, text, serial, integer, real, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { recipesTable } from "./recipes";

export const basketsTable = pgTable("baskets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode").notNull().default("cheapest"), // cheapest | healthiest | highest_protein | lowest_calorie | budget
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBasketSchema = createInsertSchema(basketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBasket = z.infer<typeof insertBasketSchema>;
export type Basket = typeof basketsTable.$inferSelect;

export const basketItemsTable = pgTable("basket_items", {
  id: serial("id").primaryKey(),
  basketId: integer("basket_id").notNull().references(() => basketsTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: real("quantity").notNull().default(1),
  unit: text("unit").notNull().default("unit"),
  isSubstitute: boolean("is_substitute").notNull().default(false),
  isEssential: boolean("is_essential").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBasketItemSchema = createInsertSchema(basketItemsTable).omit({ id: true, createdAt: true });
export type InsertBasketItem = z.infer<typeof insertBasketItemSchema>;
export type BasketItem = typeof basketItemsTable.$inferSelect;

export const basketItemRecipesTable = pgTable("basket_item_recipes", {
  id: serial("id").primaryKey(),
  basketItemId: integer("basket_item_id").notNull().references(() => basketItemsTable.id, { onDelete: "cascade" }),
  recipeId: integer("recipe_id").notNull().references(() => recipesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("basket_item_recipe_unique").on(table.basketItemId, table.recipeId)]);

export const insertBasketItemRecipeSchema = createInsertSchema(basketItemRecipesTable).omit({ id: true, createdAt: true });
export type BasketItemRecipe = typeof basketItemRecipesTable.$inferSelect;
