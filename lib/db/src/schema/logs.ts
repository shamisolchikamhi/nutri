import { pgTable, text, serial, real, integer, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyLogsTable = pgTable("daily_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  waterMl: integer("water_ml").notNull().default(0),
  weightKg: real("weight_kg"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDailyLogSchema = createInsertSchema(dailyLogsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogsTable.$inferSelect;

export const mealEntriesTable = pgTable("meal_entries", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  mealType: text("meal_type").notNull(), // breakfast | lunch | dinner | snack
  name: text("name").notNull(),
  calories: integer("calories").notNull(),
  proteinG: real("protein_g").notNull().default(0),
  carbsG: real("carbs_g").notNull().default(0),
  fatG: real("fat_g").notNull().default(0),
  servings: real("servings").notNull().default(1),
  recipeId: integer("recipe_id"),
  productId: integer("product_id"),
  isFavourite: boolean("is_favourite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMealEntrySchema = createInsertSchema(mealEntriesTable).omit({ id: true, createdAt: true });
export type InsertMealEntry = z.infer<typeof insertMealEntrySchema>;
export type MealEntry = typeof mealEntriesTable.$inferSelect;

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  steps: integer("steps").notNull().default(0),
  activeCalories: integer("active_calories").notNull().default(0),
  workoutDurationMin: integer("workout_duration_min").notNull().default(0),
  workoutType: text("workout_type"),
  sleepHours: real("sleep_hours").notNull().default(7),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertActivityLogSchema = createInsertSchema(activityLogsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogsTable.$inferSelect;
