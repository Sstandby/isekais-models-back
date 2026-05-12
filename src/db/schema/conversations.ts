import { pgTable, text, timestamp, jsonb, integer, boolean, real } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const conversations = pgTable("conversation", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New conversation"),
  primaryCategory: text("primary_category").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const turns = pgTable("turn", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull(),
  modelLabel: text("model_label").notNull(),
  settings: jsonb("settings").notNull().default({}),
  status: text("status").notNull().default("ok"),
  error: text("error"),
  payload: jsonb("payload").notNull(),
  position: integer("position").notNull().default(0),
  liked: boolean("liked").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(false),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const turnActions = pgTable("turn_action", {
  id: text("id").primaryKey(),
  turnId: text("turn_id")
    .notNull()
    .references(() => turns.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  modelId: text("model_id").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
