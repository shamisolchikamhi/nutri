CREATE TABLE "nutrition_catalog" (
	"barcode" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'open_food_facts' NOT NULL,
	"source_url" text,
	"name" text NOT NULL,
	"brand" text,
	"category" text NOT NULL,
	"pack_size" real DEFAULT 1 NOT NULL,
	"pack_unit" text DEFAULT 'unit' NOT NULL,
	"calories_per_100g" integer DEFAULT 0 NOT NULL,
	"protein_per_100g" real DEFAULT 0 NOT NULL,
	"carbs_per_100g" real DEFAULT 0 NOT NULL,
	"fat_per_100g" real DEFAULT 0 NOT NULL,
	"fiber_per_100g" real,
	"sugar_per_100g" real,
	"image_url" text DEFAULT '' NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_nutrition_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"barcode" text NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_nutrition_matches" ADD CONSTRAINT "product_nutrition_matches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_nutrition_matches" ADD CONSTRAINT "product_nutrition_matches_barcode_nutrition_catalog_barcode_fk" FOREIGN KEY ("barcode") REFERENCES "public"."nutrition_catalog"("barcode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_nutrition_match_unique" ON "product_nutrition_matches" USING btree ("product_id","barcode");