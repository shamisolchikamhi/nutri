import { pgTable, text, serial, integer, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const nutritionCatalogTable = pgTable("nutrition_catalog", {
  barcode: text("barcode").primaryKey(),
  source: text("source").notNull().default("open_food_facts"),
  sourceUrl: text("source_url"),
  name: text("name").notNull(),
  brand: text("brand"),
  category: text("category").notNull(),
  packSize: real("pack_size").notNull().default(1),
  packUnit: text("pack_unit").notNull().default("unit"),
  caloriesPer100g: integer("calories_per_100g").notNull().default(0),
  proteinPer100g: real("protein_per_100g").notNull().default(0),
  carbsPer100g: real("carbs_per_100g").notNull().default(0),
  fatPer100g: real("fat_per_100g").notNull().default(0),
  fiberPer100g: real("fiber_per_100g"),
  sugarPer100g: real("sugar_per_100g"),
  imageUrl: text("image_url").notNull().default(""),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productNutritionMatchesTable = pgTable("product_nutrition_matches", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  barcode: text("barcode").notNull().references(() => nutritionCatalogTable.barcode),
  method: text("method").notNull(), // barcode | normalized_name_pack
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("product_nutrition_match_unique").on(table.productId, table.barcode)]);
