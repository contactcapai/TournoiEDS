CREATE TYPE "public"."tournament_match_bracket" AS ENUM('principal', 'vainqueurs', 'perdants', 'grande_finale');--> statement-breakpoint
ALTER TABLE "tournament_match" ADD COLUMN "bracket" "tournament_match_bracket" DEFAULT 'principal' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_match_slot" ADD COLUMN "source" jsonb;