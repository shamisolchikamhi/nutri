import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

let recipesSchemaReady: Promise<void> | null = null;

export function ensureRecipesSchema() {
  recipesSchemaReady ??= db.execute(sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS meal_type text NOT NULL DEFAULT 'lunch_dinner'`).then(
    () => undefined,
    (error) => {
      recipesSchemaReady = null;
      throw error;
    },
  );
  return recipesSchemaReady;
}
