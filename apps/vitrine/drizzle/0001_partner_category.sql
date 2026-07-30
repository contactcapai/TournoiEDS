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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "partner_published_category_order_idx" ON "partner" USING btree ("is_published","category","sort_order");