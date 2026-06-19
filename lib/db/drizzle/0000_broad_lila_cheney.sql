CREATE TABLE "retailers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"market_code" text DEFAULT 'ZA' NOT NULL,
	"logo_url" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"current_weight_kg" real NOT NULL,
	"height_cm" real NOT NULL,
	"target_weight_kg" real NOT NULL,
	"age_years" integer NOT NULL,
	"sex" text NOT NULL,
	"activity_level" text NOT NULL,
	"body_fat_percent" real,
	"diet_preference" text DEFAULT 'standard' NOT NULL,
	"budget_weekly" real NOT NULL,
	"meal_frequency" integer DEFAULT 3 NOT NULL,
	"retailer_preferences" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"retailer_id" integer NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"price_aud" real NOT NULL,
	"regular_price_aud" real,
	"pack_size" real DEFAULT 1 NOT NULL,
	"pack_unit" text DEFAULT 'unit' NOT NULL,
	"calories_per_100g" integer DEFAULT 0 NOT NULL,
	"protein_per_100g" real DEFAULT 0 NOT NULL,
	"carbs_per_100g" real DEFAULT 0 NOT NULL,
	"fat_per_100g" real DEFAULT 0 NOT NULL,
	"fiber_per_100g" real,
	"sugar_per_100g" real,
	"is_on_special" boolean DEFAULT false NOT NULL,
	"image_url" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "specials" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"retailer_id" integer NOT NULL,
	"regular_price_aud" real NOT NULL,
	"special_price_aud" real NOT NULL,
	"savings_aud" real NOT NULL,
	"savings_percent" real NOT NULL,
	"goal_fit" text[] DEFAULT '{}' NOT NULL,
	"valid_until" date
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"name" text NOT NULL,
	"quantity" real NOT NULL,
	"unit" text NOT NULL,
	"calories" integer DEFAULT 0 NOT NULL,
	"protein_g" real DEFAULT 0 NOT NULL,
	"carbs_g" real DEFAULT 0 NOT NULL,
	"fat_g" real DEFAULT 0 NOT NULL,
	"estimated_cost" real DEFAULT 0 NOT NULL,
	"product_id" integer,
	"substitutes" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"prep_time_min" integer DEFAULT 0 NOT NULL,
	"cook_time_min" integer DEFAULT 0 NOT NULL,
	"servings" integer DEFAULT 2 NOT NULL,
	"calories_per_serving" integer NOT NULL,
	"protein_per_serving_g" real NOT NULL,
	"carbs_per_serving_g" real NOT NULL,
	"fat_per_serving_g" real NOT NULL,
	"fiber_per_serving_g" real,
	"difficulty" text DEFAULT 'easy' NOT NULL,
	"meal_type" text DEFAULT 'lunch_dinner' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"estimated_cost" real DEFAULT 0 NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"instructions" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_recipe_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"source_url" text NOT NULL,
	"creator_handle" text,
	"title" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"ingredients_text" text DEFAULT '' NOT NULL,
	"thumbnail_url" text DEFAULT '' NOT NULL,
	"market_code" text DEFAULT 'ZA' NOT NULL,
	"imported_recipe_id" integer,
	"status" text DEFAULT 'imported' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"steps" integer DEFAULT 0 NOT NULL,
	"active_calories" integer DEFAULT 0 NOT NULL,
	"workout_duration_min" integer DEFAULT 0 NOT NULL,
	"workout_type" text,
	"sleep_hours" real DEFAULT 7 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"water_ml" integer DEFAULT 0 NOT NULL,
	"weight_kg" real,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_logs_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "meal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"meal_type" text NOT NULL,
	"name" text NOT NULL,
	"calories" integer NOT NULL,
	"protein_g" real DEFAULT 0 NOT NULL,
	"carbs_g" real DEFAULT 0 NOT NULL,
	"fat_g" real DEFAULT 0 NOT NULL,
	"servings" real DEFAULT 1 NOT NULL,
	"recipe_id" integer,
	"product_id" integer,
	"is_favourite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "basket_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"basket_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" real DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'unit' NOT NULL,
	"is_substitute" boolean DEFAULT false NOT NULL,
	"is_essential" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baskets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mode" text DEFAULT 'cheapest' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_snacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specials" ADD CONSTRAINT "specials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specials" ADD CONSTRAINT "specials_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basket_items" ADD CONSTRAINT "basket_items_basket_id_baskets_id_fk" FOREIGN KEY ("basket_id") REFERENCES "public"."baskets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basket_items" ADD CONSTRAINT "basket_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_recipes" ADD CONSTRAINT "saved_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_snacks" ADD CONSTRAINT "saved_snacks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;