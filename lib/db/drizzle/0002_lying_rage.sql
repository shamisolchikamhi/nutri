ALTER TABLE "retailers" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "canonical_source_url" text;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "store" text;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "channel" text DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "currency" text DEFAULT 'ZAR' NOT NULL;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "scraped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "canonical_source_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "store" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "channel" text DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "currency" text DEFAULT 'ZAR' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" RENAME COLUMN "price_aud" TO "price";--> statement-breakpoint
ALTER TABLE "products" RENAME COLUMN "regular_price_aud" TO "regular_price";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "stock_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "scraped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "last_verified_at" timestamp with time zone;
