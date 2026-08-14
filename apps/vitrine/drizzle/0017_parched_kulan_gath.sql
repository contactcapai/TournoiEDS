ALTER TABLE "event" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "price_text" text;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "price_text" text;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_price_text_valide" CHECK ("event"."price_text" is null or (length(btrim("event"."price_text")) > 0 and length("event"."price_text") <= 80));--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_fin_apres_debut" CHECK ("event"."ends_at" is null or "event"."ends_at" > "event"."starts_at");--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_price_text_valide" CHECK ("tournament"."price_text" is null or (length(btrim("tournament"."price_text")) > 0 and length("tournament"."price_text") <= 80));--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_fin_apres_debut" CHECK ("tournament"."ends_at" is null or "tournament"."ends_at" > "tournament"."starts_at");