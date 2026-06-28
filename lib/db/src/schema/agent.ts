import { pgTable, serial, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const agentActionsTable = pgTable("agent_actions", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  idempotencyKey: text("idempotency_key").notNull(),
  result: jsonb("result"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("agent_action_idempotency_unique").on(table.idempotencyKey)]);

export type AgentAction = typeof agentActionsTable.$inferSelect;
