CREATE TYPE "public"."workshop_family" AS ENUM('atelier', 'sensibilisation', 'evenement');--> statement-breakpoint
CREATE TABLE "workshop" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"audience" text,
	"family" "workshop_family" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_title_valide" CHECK (length(btrim("workshop"."title")) > 0 and length("workshop"."title") <= 80),
	CONSTRAINT "workshop_summary_valide" CHECK ("workshop"."summary" is null or (length(btrim("workshop"."summary")) > 0 and length("workshop"."summary") <= 200)),
	CONSTRAINT "workshop_audience_valide" CHECK ("workshop"."audience" is null or (length(btrim("workshop"."audience")) > 0 and length("workshop"."audience") <= 120))
);
--> statement-breakpoint
CREATE INDEX "workshop_published_family_order_idx" ON "workshop" USING btree ("is_published","family","sort_order");