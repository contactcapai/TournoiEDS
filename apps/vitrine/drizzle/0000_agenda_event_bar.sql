CREATE TYPE "public"."event_type" AS ENUM('thursday', 'special');--> statement-breakpoint
CREATE TABLE "bar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"district" text NOT NULL,
	"city" text DEFAULT 'Reims' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "event_type" DEFAULT 'thursday' NOT NULL,
	"title" text NOT NULL,
	"bar_id" uuid,
	"venue_name" text,
	"venue_address" text,
	"starts_at" timestamp with time zone NOT NULL,
	"games" text,
	"description" text,
	"recap" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_has_venue" CHECK ("event"."bar_id" is not null or "event"."venue_name" is not null)
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_bar_id_bar_id_fk" FOREIGN KEY ("bar_id") REFERENCES "public"."bar"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_published_starts_at_idx" ON "event" USING btree ("is_published","starts_at");