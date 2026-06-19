import { pgTable, text, serial, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { retailersTable } from "./retailers";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  externalId: text("external_id"),
  barcode: text("barcode"),
  brand: text("brand"),
  retailerId: integer("retailer_id").notNull().references(() => retailersTable.id),
  canonicalSourceUrl: text("canonical_source_url"),
  region: text("region"),
  store: text("store"),
  channel: text("channel").notNull().default("online"),
  currency: text("currency").notNull().default("ZAR"),
  category: text("category").notNull().default("other"), // protein | dairy | pantry | fruit_veg | snacks | drinks | grains | condiments | frozen | other
  priceAud: real("price").notNull(),
  regularPriceAud: real("regular_price"),
  packSize: real("pack_size").notNull().default(1),
  packUnit: text("pack_unit").notNull().default("unit"),
  caloriesPer100g: integer("calories_per_100g").notNull().default(0),
  proteinPer100g: real("protein_per_100g").notNull().default(0),
  carbsPer100g: real("carbs_per_100g").notNull().default(0),
  fatPer100g: real("fat_per_100g").notNull().default(0),
  fiberPer100g: real("fiber_per_100g"),
  sugarPer100g: real("sugar_per_100g"),
  isOnSpecial: boolean("is_on_special").notNull().default(false),
  stockStatus: text("stock_status").notNull().default("unknown"),
  imageUrl: text("image_url").notNull().default(""),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
