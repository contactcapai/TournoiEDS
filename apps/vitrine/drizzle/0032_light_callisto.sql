ALTER TABLE "event" ADD COLUMN "photo_id" uuid;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "dans_la_galerie" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;