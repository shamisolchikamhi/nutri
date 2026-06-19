import { pgTable, serial, integer, real, text, date, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { retailersTable } from "./retailers";

export const specialsTable = pgTable("specials", {
  id: serial("id").primaryKey(),
  externalId: text("external_id"),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  retailerId: integer("retailer_id").notNull().references(() => retailersTable.id),
  promotionType: text("promotion_type").notNull().default("single_price"),
  regularPriceAud: real("regular_price").notNull(),
  specialPriceAud: real("special_price").notNull(),
  savingsAud: real("savings").notNull(),
  savingsPercent: real("savings_percent").notNull(),
  multibuyQuantity: integer("multibuy_quantity"),
  multibuyPrice: real("multibuy_price"),
  loyaltyRequired: boolean("loyalty_required").notNull().default(false),
  stockStatus: text("stock_status").notNull().default("unknown"),
  region: text("region"),
  store: text("store"),
  channel: text("channel").notNull().default("online"),
  currency: text("currency").notNull().default("ZAR"),
  terms: text("terms"),
  sourceUrl: text("source_url"),
  goalFit: text("goal_fit").array().notNull().default([]),
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  isStale: boolean("is_stale").notNull().default(false),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
}, (table) => [uniqueIndex("special_retailer_external_unique").on(table.retailerId, table.externalId)]);

export const insertSpecialSchema = createInsertSchema(specialsTable).omit({ id: true });
export type InsertSpecial = z.infer<typeof insertSpecialSchema>;
export type Special = typeof specialsTable.$inferSelect;
