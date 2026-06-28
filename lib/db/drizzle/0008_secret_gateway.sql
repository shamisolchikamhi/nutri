CREATE TABLE "agent_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"result" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_action_idempotency_unique" ON "agent_actions" USING btree ("idempotency_key");