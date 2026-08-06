CREATE TABLE "site_setting" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"discord_url" text,
	"instagram_url" text,
	"x_url" text,
	"linkedin_url" text,
	"helloasso_url" text,
	"contact_email" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_setting_ligne_unique" CHECK ("site_setting"."id" = 1),
	CONSTRAINT "site_setting_discord_url_valide" CHECK ("site_setting"."discord_url" is null or (length("site_setting"."discord_url") <= 300 and "site_setting"."discord_url" ~ '^https?://')),
	CONSTRAINT "site_setting_instagram_url_valide" CHECK ("site_setting"."instagram_url" is null or (length("site_setting"."instagram_url") <= 300 and "site_setting"."instagram_url" ~ '^https?://')),
	CONSTRAINT "site_setting_x_url_valide" CHECK ("site_setting"."x_url" is null or (length("site_setting"."x_url") <= 300 and "site_setting"."x_url" ~ '^https?://')),
	CONSTRAINT "site_setting_linkedin_url_valide" CHECK ("site_setting"."linkedin_url" is null or (length("site_setting"."linkedin_url") <= 300 and "site_setting"."linkedin_url" ~ '^https?://')),
	CONSTRAINT "site_setting_helloasso_url_valide" CHECK ("site_setting"."helloasso_url" is null or (length("site_setting"."helloasso_url") <= 300 and "site_setting"."helloasso_url" ~ '^https?://')),
	CONSTRAINT "site_setting_contact_email_valide" CHECK (length(btrim("site_setting"."contact_email")) > 0 and length("site_setting"."contact_email") <= 254 and "site_setting"."contact_email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
--> statement-breakpoint
-- ═══════════════════════════════════════════════════════════════════════════════════════
-- LA LIGNE UNIQUE — ÉCRITE À LA MAIN, drizzle-kit ne génère que le DDL (Story 6.13)
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- Sans cet INSERT, la table existerait VIDE : le lecteur retomberait sur ses valeurs de repli
-- et l'écran de réglages n'aurait aucune ligne à modifier. Le repli existe (il protège d'une
-- restauration partielle), mais il ne doit pas être l'état nominal.
--
-- Les valeurs reprennent EXACTEMENT l'état de `src/lib/links.ts` au moment de la migration :
--   · les 5 URL sont NULL — la Story 5.5 n'a posé AUCUNE destination réelle (dette R29,
--     arbitrage de Brice du 2026-07-31 : des placeholders jusqu'à la toute fin du projet).
--     C'est ce back-office qui devient l'endroit où l'équipe les renseignera.
--     🔴 Ne PAS y semer une valeur « générique mais valide » : `helloasso_url` a valu
--     https://www.helloasso.com/ jusqu'à la 5.5, et c'était le pire des cinq cas — une vraie
--     URL https, donc classée sortante, donc un CTA qui ouvrait un nouvel onglet vers un site
--     tiers sans rapport avec l'association. Un placeholder est inerte ; cela était ACTIF ET FAUX.
--   · `contact_email` reprend la constante CONTACT_EMAIL, seule des six à être réelle et stable.
--
-- `ON CONFLICT DO NOTHING` : la migration doit pouvoir être rejouée sur une base qui porterait
-- déjà la ligne (restauration, environnement déjà migré) sans échouer sur la clé primaire.
INSERT INTO "site_setting" ("id", "contact_email")
VALUES (1, 'esportdessacres@gmail.com')
ON CONFLICT ("id") DO NOTHING;
