CREATE TABLE "user_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"pseudo" text,
	"discord_pseudo" text,
	"riot_id" text,
	"steam_id" text,
	"epic_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_pseudo_non_blanc" CHECK ("user_profile"."pseudo" is null or length(btrim("user_profile"."pseudo")) > 0),
	CONSTRAINT "user_profile_discord_non_blanc" CHECK ("user_profile"."discord_pseudo" is null or length(btrim("user_profile"."discord_pseudo")) > 0),
	CONSTRAINT "user_profile_riot_non_blanc" CHECK ("user_profile"."riot_id" is null or length(btrim("user_profile"."riot_id")) > 0),
	CONSTRAINT "user_profile_steam_non_blanc" CHECK ("user_profile"."steam_id" is null or length(btrim("user_profile"."steam_id")) > 0),
	CONSTRAINT "user_profile_epic_non_blanc" CHECK ("user_profile"."epic_id" is null or length(btrim("user_profile"."epic_id")) > 0)
);
--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;