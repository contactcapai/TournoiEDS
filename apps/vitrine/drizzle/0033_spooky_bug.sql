ALTER TABLE "bar" DROP CONSTRAINT "bar_district_valide";--> statement-breakpoint
ALTER TABLE "bar" DROP CONSTRAINT "bar_city_valide";--> statement-breakpoint
ALTER TABLE "bar" ALTER COLUMN "district" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bar" ALTER COLUMN "city" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bar" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bar" ADD CONSTRAINT "bar_district_valide" CHECK ("bar"."district" is null or (length(btrim("bar"."district")) > 0 and length("bar"."district") <= 120));--> statement-breakpoint
ALTER TABLE "bar" ADD CONSTRAINT "bar_city_valide" CHECK ("bar"."city" is null or (length(btrim("bar"."city")) > 0 and length("bar"."city") <= 80));