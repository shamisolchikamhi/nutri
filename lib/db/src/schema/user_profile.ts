import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfileTable = pgTable("user_profile", {
  id: serial("id").primaryKey(),
  currentWeightKg: real("current_weight_kg").notNull(),
  heightCm: real("height_cm").notNull(),
  targetWeightKg: real("target_weight_kg").notNull(),
  ageYears: integer("age_years").notNull(),
  sex: text("sex").notNull(), // male | female | other
  activityLevel: text("activity_level").notNull(), // sedentary | lightly_active | moderately_active | very_active | extra_active
  bodyFatPercent: real("body_fat_percent"),
  dietPreference: text("diet_preference").notNull().default("standard"), // standard | high_protein | low_calorie | low_carb | vegan | halal | vegetarian
  budgetWeekly: real("budget_weekly").notNull(),
  mealFrequency: integer("meal_frequency").notNull().default(3),
  retailerPreferences: text("retailer_preferences").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserProfileSchema = createInsertSchema(userProfileTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfileTable.$inferSelect;
