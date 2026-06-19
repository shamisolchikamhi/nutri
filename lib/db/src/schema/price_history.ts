import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const productPriceHistoryTable = pgTable("product_price_history", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  price: real("price").notNull(),
  regularPrice: real("regular_price"),
  currency: text("currency").notNull(),
  sourceUrl: text("source_url"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
});
