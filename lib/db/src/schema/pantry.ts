import { pgTable, serial, text, real, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pantryItemsTable = pgTable("pantry_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  quantity: real("quantity").notNull().default(1),
  unit: text("unit").notNull().default("item"),
  category: text("category").notNull().default("other"),
  source: text("source").notNull().default("manual"), // manual | receipt | pantry_photo
  expiresOn: date("expires_on"),
  confirmed: boolean("confirmed").notNull().default(false),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPantryItemSchema = createInsertSchema(pantryItemsTable).omit({
  id: true,
  capturedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPantryItem = z.infer<typeof insertPantryItemSchema>;
export type PantryItem = typeof pantryItemsTable.$inferSelect;
