CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"primary_category" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turn_action" (
	"id" text PRIMARY KEY NOT NULL,
	"turn_id" text NOT NULL,
	"kind" text NOT NULL,
	"model_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turn" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"model_id" text NOT NULL,
	"model_label" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"error" text,
	"payload" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn_action" ADD CONSTRAINT "turn_action_turn_id_turn_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turn"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn" ADD CONSTRAINT "turn_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;