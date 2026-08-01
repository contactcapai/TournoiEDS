CREATE TYPE "public"."solicitation_type" AS ENUM('animation', 'partenariat', 'autre');--> statement-breakpoint
CREATE TABLE "solicitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"request_type" "solicitation_type" NOT NULL,
	"message" text NOT NULL,
	"consent_given" boolean DEFAULT false NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "solicitation_name_valide" CHECK (length(btrim("solicitation"."name")) > 0 and length("solicitation"."name") <= 120),
	CONSTRAINT "solicitation_email_valide" CHECK (length(btrim("solicitation"."email")) > 0 and position('@' in "solicitation"."email") > 0 and length("solicitation"."email") <= 254),
	CONSTRAINT "solicitation_message_valide" CHECK (length(btrim("solicitation"."message")) > 0 and length("solicitation"."message") <= 5000),
	CONSTRAINT "solicitation_consent_given" CHECK ("solicitation"."consent_given" = true)
);
--> statement-breakpoint
CREATE INDEX "solicitation_processed_created_at_idx" ON "solicitation" USING btree ("is_processed","created_at");