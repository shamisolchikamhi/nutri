import { pgTable, text, serial, real, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { retailersTable } from "./retailers";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand"),
  retailerId: integer("retailer_id").notNull().references(() => retailersTable.id),
  category: text("category").notNull().default("other"), // protein | dairy | pantry | fruit_veg | snacks | drinks | grains | condiments | frozen | other
  priceAud: real("price_aud").notNull(),
  regularPriceAud: real("regular_price_aud"),
  packSize: real("pack_size").notNull().default(1),
  packUnit: text("pack_unit").notNull().default("unit"),
  caloriesPer100g: integer("calories_per_100g").notNull().default(0),
  proteinPer100g: real("protein_per_100g").notNull().default(0),
  carbsPer100g: real("carbs_per_100g").notNull().default(0),
  fatPer100g: real("fat_per_100g").notNull().default(0),
  fiberPer100g: real("fiber_per_100g"),
  sugarPer100g: real("sugar_per_100g"),
  isOnSpecial: boolean("is_on_special").notNull().default(false),
  imageUrl: text("image_url").notNull().default(""),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
