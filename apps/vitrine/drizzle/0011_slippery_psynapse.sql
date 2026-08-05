CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"role" text NOT NULL,
	"portrait" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_prenom_valide" CHECK (length(btrim("member"."first_name")) > 0 and length("member"."first_name") <= 60),
	CONSTRAINT "member_role_valide" CHECK (length(btrim("member"."role")) > 0 and length("member"."role") <= 80),
	CONSTRAINT "member_portrait_valide" CHECK ("member"."portrait" is null or (length("member"."portrait") <= 200 and "member"."portrait" ~ '^/medias/portraits/[a-z0-9][a-z0-9._-]*\.webp$' and "member"."portrait" !~ '\.\.'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "member_portrait_unique" ON "member" USING btree ("portrait");--> statement-breakpoint
CREATE INDEX "member_published_order_idx" ON "member" USING btree ("is_published","sort_order");