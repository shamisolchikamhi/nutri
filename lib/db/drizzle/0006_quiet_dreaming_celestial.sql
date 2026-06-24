CREATE TABLE "pantry_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"quantity" real DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'item' NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"expires_on" date,
	"confirmed" boolean DEFAULT false NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
