ALTER TABLE "partner" DROP CONSTRAINT "partner_name_not_blank";--> statement-breakpoint
ALTER TABLE "partner" DROP CONSTRAINT "partner_logo_not_blank";--> statement-breakpoint
ALTER TABLE "partner" DROP CONSTRAINT "partner_link_not_blank";--> statement-breakpoint
CREATE UNIQUE INDEX "partner_logo_unique" ON "partner" USING btree ("logo");--> statement-breakpoint
ALTER TABLE "partner" ADD CONSTRAINT "partner_name_valide" CHECK (length(btrim("partner"."name")) > 0 and length("partner"."name") <= 120);--> statement-breakpoint
ALTER TABLE "partner" ADD CONSTRAINT "partner_description_valide" CHECK ("partner"."description" is null or (length(btrim("partner"."description")) > 0 and length("partner"."description") <= 200));--> statement-breakpoint
ALTER TABLE "partner" ADD CONSTRAINT "partner_link_valide" CHECK ("partner"."link" is null or (length(btrim("partner"."link")) > 0 and length("partner"."link") <= 300));--> statement-breakpoint
ALTER TABLE "partner" ADD CONSTRAINT "partner_logo_valide" CHECK ("partner"."logo" is null or (length("partner"."logo") <= 200 and "partner"."logo" ~ '^(/medias/logos/|/partenaires/)[a-z0-9][a-z0-9._-]*\.webp$' and "partner"."logo" !~ '\.\.'));