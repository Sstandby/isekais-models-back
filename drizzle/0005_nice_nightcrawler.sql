ALTER TABLE "turn" ADD COLUMN "prompt_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "turn" ADD COLUMN "completion_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "turn" ADD COLUMN "total_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "turn" ADD COLUMN "cost_usd" real DEFAULT 0 NOT NULL;