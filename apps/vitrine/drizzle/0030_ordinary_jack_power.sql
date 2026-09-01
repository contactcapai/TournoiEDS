ALTER TABLE "photo" ADD COLUMN "focal_x" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "focal_y" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_setting" ADD COLUMN "hero_photo_id" uuid;--> statement-breakpoint
ALTER TABLE "site_setting" ADD CONSTRAINT "site_setting_hero_photo_id_photo_id_fk" FOREIGN KEY ("hero_photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_focal_borne" CHECK ("photo"."focal_x" between 0 and 100 and "photo"."focal_y" between 0 and 100);