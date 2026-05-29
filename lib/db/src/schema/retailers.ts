import { pgTable, text, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const retailersTable = pgTable("retailers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertRetailerSchema = createInsertSchema(retailersTable).omit({ id: true });
export type InsertRetailer = z.infer<typeof insertRetailerSchema>;
export type Retailer = typeof retailersTable.$inferSelect;
