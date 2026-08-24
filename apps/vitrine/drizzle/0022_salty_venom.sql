ALTER TYPE "public"."tournament_phase_kind" ADD VALUE 'suisse';--> statement-breakpoint
ALTER TABLE "tournament_phase" ADD COLUMN "played_on" date;