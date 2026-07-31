ALTER TABLE "photo" DROP CONSTRAINT "photo_caption_not_blank";--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_filename_unique" UNIQUE("filename");--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_caption_valide" CHECK ("photo"."caption" is null or (length(btrim("photo"."caption")) > 0 and length("photo"."caption") <= 60));