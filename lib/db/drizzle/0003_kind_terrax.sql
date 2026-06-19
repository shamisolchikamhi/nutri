ALTER TABLE "specials" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "promotion_type" text DEFAULT 'single_price' NOT NULL;--> statement-breakpoint
ALTER TABLE "specials" RENAME COLUMN "regular_price_aud" TO "regular_price";--> statement-breakpoint
ALTER TABLE "specials" RENAME COLUMN "special_price_aud" TO "special_price";--> statement-breakpoint
ALTER TABLE "specials" RENAME COLUMN "savings_aud" TO "savings";--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "multibuy_quantity" integer;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "multibuy_price" real;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "loyalty_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "stock_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "store" text;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "channel" text DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "currency" text DEFAULT 'ZAR' NOT NULL;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "terms" text;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "valid_from" date;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "is_stale" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "scraped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "specials" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "special_retailer_external_unique" ON "specials" USING btree ("retailer_id","external_id");
