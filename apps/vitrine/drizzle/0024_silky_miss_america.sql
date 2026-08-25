CREATE TYPE "public"."user_role_name" AS ENUM('admin_site', 'admin_tournoi');--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_id" uuid NOT NULL,
	"role" "user_role_name" NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "user_role_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_role_user_id_idx" ON "user_role" USING btree ("user_id");--> statement-breakpoint
-- ════════════════════════════════════════════════════════════════════════════════════
-- 🔴 GRAINE ANTI-VERROUILLAGE (Story 8.1) — SANS ELLE, CETTE MIGRATION FERME LE BACK-OFFICE
-- ════════════════════════════════════════════════════════════════════════════════════
--
-- À partir d'ici, c'est `user_role` qui ouvre les portes, plus l'allowlist. Une table vide
-- signifierait donc : plus aucun administrateur, sur staging comme en production, dès le
-- déploiement — et le seul recours serait le noyau de secours `AUTH_ADMIN_DISCORD_IDS`.
--
-- 🔴 POURQUOI « TOUS LES COMPTES EXISTANTS », ET POURQUOI CE N'EST PAS UNE APPROXIMATION.
-- Jusqu'à cette story, `callbacks.signIn` refuse AVANT que l'adaptateur n'écrive quoi que ce
-- soit : aucune ligne `user` ne peut exister sans avoir passé `AUTH_ADMIN_DISCORD_IDS`.
-- L'ensemble « les lignes de `user` » est donc EXACTEMENT l'ensemble « les administrateurs
-- autorisés aujourd'hui ». Cette graine reconduit l'accès en place, elle ne l'élargit pas.
-- ⚠️ Ce raisonnement cesse d'être vrai dès la PR ② (Google + lien magique ouvrent la
-- connexion) : c'est pourquoi la graine vit ICI, dans la migration qui précède, et non plus
-- tard où elle donnerait les deux rôles au premier inconnu venu.
--
-- Les DEUX rôles, parce que la séparation A2 est neuve : personne n'a encore arbitré qui
-- perd quoi. L'écran des accès sert précisément à le retirer, compte par compte.
INSERT INTO "user_role" ("user_id", "role")
SELECT "id", "role"
FROM "user"
CROSS JOIN (VALUES ('admin_site'::"public"."user_role_name"), ('admin_tournoi'::"public"."user_role_name")) AS r("role")
ON CONFLICT DO NOTHING;
