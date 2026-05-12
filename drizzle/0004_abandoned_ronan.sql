ALTER TABLE "turn" ADD COLUMN "liked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "turn" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;