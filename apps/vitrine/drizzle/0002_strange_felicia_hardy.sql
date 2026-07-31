CREATE TABLE "photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"alt" text NOT NULL,
	"caption" text,
	"event_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_filename_safe" CHECK ("photo"."filename" ~ '^[a-z0-9][a-z0-9._-]*\.(jpg|jpeg|png|webp|avif)$' and "photo"."filename" !~ '\.\.'),
	CONSTRAINT "photo_alt_not_blank" CHECK (length(btrim("photo"."alt")) > 0),
	CONSTRAINT "photo_caption_not_blank" CHECK ("photo"."caption" is null or length(btrim("photo"."caption")) > 0)
);
--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_published_order_idx" ON "photo" USING btree ("is_published","sort_order");--> statement-breakpoint
CREATE INDEX "photo_event_order_idx" ON "photo" USING btree ("event_id","sort_order");