CREATE TYPE "public"."tournament_entry_state" AS ENUM('inscrit', 'present', 'absent');--> statement-breakpoint
CREATE TYPE "public"."tournament_match_state" AS ENUM('a_jouer', 'en_cours', 'terminee');--> statement-breakpoint
CREATE TYPE "public"."tournament_phase_kind" AS ENUM('poule', 'bracket', 'lobbies', 'finale');--> statement-breakpoint
CREATE TYPE "public"."tournament_phase_state" AS ENUM('planifiee', 'en_cours', 'terminee');--> statement-breakpoint
CREATE TABLE "tournament_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"state" "tournament_entry_state" DEFAULT 'inscrit' NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_entry_display_name_non_blanc" CHECK (length(btrim("tournament_entry"."display_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "tournament_entry_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"display_name" text NOT NULL,
	"user_id" uuid,
	CONSTRAINT "tournament_entry_member_position_positive" CHECK ("tournament_entry_member"."position" >= 1),
	CONSTRAINT "tournament_entry_member_display_name_non_blanc" CHECK (length(btrim("tournament_entry_member"."display_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "tournament_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"round" integer,
	"state" "tournament_match_state" DEFAULT 'a_jouer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_match_position_positive" CHECK ("tournament_match"."position" >= 1),
	CONSTRAINT "tournament_match_round_positive" CHECK ("tournament_match"."round" is null or "tournament_match"."round" >= 1)
);
--> statement-breakpoint
CREATE TABLE "tournament_match_slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"entry_id" uuid,
	"score" integer,
	"rank" integer,
	CONSTRAINT "tournament_match_slot_position_positive" CHECK ("tournament_match_slot"."position" >= 1),
	CONSTRAINT "tournament_match_slot_score_positif" CHECK ("tournament_match_slot"."score" is null or "tournament_match_slot"."score" >= 0),
	CONSTRAINT "tournament_match_slot_rank_positif" CHECK ("tournament_match_slot"."rank" is null or "tournament_match_slot"."rank" >= 1)
);
--> statement-breakpoint
CREATE TABLE "tournament_phase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"kind" "tournament_phase_kind" NOT NULL,
	"state" "tournament_phase_state" DEFAULT 'planifiee' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_phase_position_positive" CHECK ("tournament_phase"."position" >= 1),
	CONSTRAINT "tournament_phase_name_non_blanc" CHECK (length(btrim("tournament_phase"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "tournament_entry" ADD CONSTRAINT "tournament_entry_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry_member" ADD CONSTRAINT "tournament_entry_member_entry_id_tournament_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entry_member" ADD CONSTRAINT "tournament_entry_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match" ADD CONSTRAINT "tournament_match_phase_id_tournament_phase_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."tournament_phase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match_slot" ADD CONSTRAINT "tournament_match_slot_match_id_tournament_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tournament_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_match_slot" ADD CONSTRAINT "tournament_match_slot_entry_id_tournament_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_phase" ADD CONSTRAINT "tournament_phase_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_entry_external_unique" ON "tournament_entry" USING btree ("tournament_id","external_id") WHERE "tournament_entry"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "tournament_entry_tournoi_idx" ON "tournament_entry" USING btree ("tournament_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_entry_member_ordre_unique" ON "tournament_entry_member" USING btree ("entry_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_match_ordre_unique" ON "tournament_match" USING btree ("phase_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_match_slot_ordre_unique" ON "tournament_match_slot" USING btree ("match_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_match_slot_engage_unique" ON "tournament_match_slot" USING btree ("match_id","entry_id") WHERE "tournament_match_slot"."entry_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_phase_ordre_unique" ON "tournament_phase" USING btree ("tournament_id","position");