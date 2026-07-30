CREATE TYPE "public"."partner_category" AS ENUM('sponsor', 'partenaire', 'soutien', 'participation');--> statement-breakpoint
CREATE TABLE "partner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo" text,
	"description" text,
	"link" text,
	"category" "partner_category" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_name_not_blank" CHECK (length(btrim("partner"."name")) > 0),
	CONSTRAINT "partner_logo_not_blank" CHECK ("partner"."logo" is null or length(btrim("partner"."logo")) > 0),
	CONSTRAINT "partner_link_not_blank" CHECK ("partner"."link" is null or length(btrim("partner"."link")) > 0)
);
--> statement-breakpoint
CREATE INDEX "partner_published_category_order_idx" ON "partner" USING btree ("is_published","category","sort_order");