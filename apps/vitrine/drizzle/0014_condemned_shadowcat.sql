CREATE TYPE "public"."tournament_registration_mode" AS ENUM('interne', 'mately');--> statement-breakpoint
CREATE TYPE "public"."tournament_registration_state" AS ENUM('ouvertes', 'completes', 'fermees');--> statement-breakpoint
CREATE TABLE "tournament" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"game" text NOT NULL,
	"slug" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"venue_name" text,
	"format_text" text,
	"prizes" text,
	"match_duration_minutes" integer,
	"capacity" integer,
	"registration_mode" "tournament_registration_mode" NOT NULL,
	"registration_url" text,
	"registration_state" "tournament_registration_state" DEFAULT 'fermees' NOT NULL,
	"podium_first" text,
	"podium_second" text,
	"podium_third" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tournament_mately_a_son_url" CHECK ("tournament"."registration_mode" is null or "tournament"."registration_mode" <> 'mately' or "tournament"."registration_url" is not null),
	CONSTRAINT "tournament_name_valide" CHECK (length(btrim("tournament"."name")) > 0 and length("tournament"."name") <= 80),
	CONSTRAINT "tournament_game_valide" CHECK (length(btrim("tournament"."game")) > 0 and length("tournament"."game") <= 120),
	CONSTRAINT "tournament_slug_valide" CHECK ("tournament"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("tournament"."slug") <= 80),
	CONSTRAINT "tournament_venue_name_valide" CHECK ("tournament"."venue_name" is null or (length(btrim("tournament"."venue_name")) > 0 and length("tournament"."venue_name") <= 120)),
	CONSTRAINT "tournament_format_text_valide" CHECK ("tournament"."format_text" is null or (length(btrim("tournament"."format_text")) > 0 and length("tournament"."format_text") <= 600)),
	CONSTRAINT "tournament_prizes_valide" CHECK ("tournament"."prizes" is null or (length(btrim("tournament"."prizes")) > 0 and length("tournament"."prizes") <= 200)),
	CONSTRAINT "tournament_match_duration_valide" CHECK ("tournament"."match_duration_minutes" is null or ("tournament"."match_duration_minutes" >= 1 and "tournament"."match_duration_minutes" <= 600)),
	CONSTRAINT "tournament_capacity_valide" CHECK ("tournament"."capacity" is null or ("tournament"."capacity" >= 1 and "tournament"."capacity" <= 4096)),
	CONSTRAINT "tournament_registration_url_valide" CHECK ("tournament"."registration_url" is null or (length("tournament"."registration_url") <= 300 and "tournament"."registration_url" ~ '^https?://')),
	CONSTRAINT "tournament_podium_first_valide" CHECK ("tournament"."podium_first" is null or (length(btrim("tournament"."podium_first")) > 0 and length("tournament"."podium_first") <= 120)),
	CONSTRAINT "tournament_podium_second_valide" CHECK ("tournament"."podium_second" is null or (length(btrim("tournament"."podium_second")) > 0 and length("tournament"."podium_second") <= 120)),
	CONSTRAINT "tournament_podium_third_valide" CHECK ("tournament"."podium_third" is null or (length(btrim("tournament"."podium_third")) > 0 and length("tournament"."podium_third") <= 120)),
	CONSTRAINT "tournament_podium_sans_trou_2" CHECK ("tournament"."podium_second" is null or "tournament"."podium_first" is not null),
	CONSTRAINT "tournament_podium_sans_trou_3" CHECK ("tournament"."podium_third" is null or "tournament"."podium_second" is not null)
);
--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournament_published_starts_at_idx" ON "tournament" USING btree ("is_published","starts_at");--> statement-breakpoint
CREATE INDEX "tournament_event_starts_at_idx" ON "tournament" USING btree ("event_id","starts_at");