CREATE TABLE "rules_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rules_template_name_unique" UNIQUE("name"),
	CONSTRAINT "rules_template_name_valide" CHECK (length(btrim("rules_template"."name")) > 0 and length("rules_template"."name") <= 80),
	CONSTRAINT "rules_template_body_valide" CHECK (length(btrim("rules_template"."body")) > 0 and length("rules_template"."body") <= 40000)
);
--> statement-breakpoint
ALTER TABLE "tournament" ADD COLUMN "rules" text;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_rules_valide" CHECK ("tournament"."rules" is null or (length(btrim("tournament"."rules")) > 0 and length("tournament"."rules") <= 40000));