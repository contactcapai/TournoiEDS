ALTER TABLE "site_setting" ADD COLUMN "quote_photo_id" uuid;--> statement-breakpoint
ALTER TABLE "site_setting" ADD COLUMN "og_photo_id" uuid;--> statement-breakpoint
ALTER TABLE "site_setting" ADD CONSTRAINT "site_setting_quote_photo_id_photo_id_fk" FOREIGN KEY ("quote_photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_setting" ADD CONSTRAINT "site_setting_og_photo_id_photo_id_fk" FOREIGN KEY ("og_photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;