import { pgTable, serial, integer, real, text, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { retailersTable } from "./retailers";

export const specialsTable = pgTable("specials", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  retailerId: integer("retailer_id").notNull().references(() => retailersTable.id),
  regularPriceAud: real("regular_price_aud").notNull(),
  specialPriceAud: real("special_price_aud").notNull(),
  savingsAud: real("savings_aud").notNull(),
  savingsPercent: real("savings_percent").notNull(),
  goalFit: text("goal_fit").array().notNull().default([]),
  validUntil: date("valid_until"),
});

export const insertSpecialSchema = createInsertSchema(specialsTable).omit({ id: true });
export type InsertSpecial = z.infer<typeof insertSpecialSchema>;
export type Special = typeof specialsTable.$inferSelect;
