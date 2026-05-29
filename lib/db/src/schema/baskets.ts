import { pgTable, text, serial, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

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
