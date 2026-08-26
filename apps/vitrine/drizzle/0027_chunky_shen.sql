CREATE TYPE "public"."tournament_claim_state" AS ENUM('en_attente', 'acceptee', 'refusee');--> statement-breakpoint
CREATE TABLE "tournament_entry_claim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"state" "tournament_claim_state" DEFAULT 'en_attente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tournament_entry" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "tournament_entry_claim" ADD CONSTRAINT "tournament_entry_claim_entry_id_tournament_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry_claim" ADD CONSTRAINT "tournament_entry_claim_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_entry_claim_unique" ON "tournament_entry_claim" USING btree ("entry_id","user_id");--> statement-breakpoint
CREATE INDEX "tournament_entry_claim_attente_idx" ON "tournament_entry_claim" USING btree ("state");--> statement-breakpoint
ALTER TABLE "tournament_entry" ADD CONSTRAINT "tournament_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;