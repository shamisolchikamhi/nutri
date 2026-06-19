import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const retailersTable = pgTable("retailers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  externalId: text("external_id"),
  marketCode: text("market_code").notNull().default("ZA"), // ISO 3166-1 alpha-2 market, e.g. ZA | AU | GB | US
  canonicalSourceUrl: text("canonical_source_url"),
  region: text("region"),
  store: text("store"),
  channel: text("channel").notNull().default("online"),
  currency: text("currency").notNull().default("ZAR"),
  logoUrl: text("logo_url").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
});

export const insertRetailerSchema = createInsertSchema(retailersTable).omit({ id: true });
export type InsertRetailer = z.infer<typeof insertRetailerSchema>;
export type Retailer = typeof retailersTable.$inferSelect;
