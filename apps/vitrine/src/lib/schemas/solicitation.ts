/**
 * Schéma de validation partagé d'une sollicitation (AR-DB4, Story 5.1).
 *
 * Vit sous `src/lib/` et non `src/server/` : il est importé par le formulaire CLIENT
 * (`SolicitationForm`) autant que par la Server Action `submitSolicitation` qui écrit en base.
 * Un seul schéma des deux côtés, sinon les deux règles divergent au premier changement.
 *
 * 🔴 CE FICHIER EST LA SOURCE DES VALEURS DE L'ENUM `solicitation_type` : `schema.ts` importe
 * `SOLICITATION_TYPES` d'ici pour construire le `pgEnum`. Le sens de la dépendance est celui-là
 * et pas l'inverse — importer `schema.ts` depuis un module que le client bundle ferait entrer
 * tout Drizzle dans le navigateur. Patron posé par `event.ts` (3.1), repris par `partner.ts` (4.1)
 * et `photo.ts` (4.3).
 */
import { z } from "zod";

import { visiblementVide } from "./texte";

/**
 * Valeurs de l'enum `solicitation_type`, **définies ici une seule fois** (FR32, epics.md Story 5.1).
 * L'ordre n'est pas contraint par un rendu (ce ne sont pas des tuiles triées) : il correspond à
 * l'ordre attendu des radios du formulaire.
 */
export const SOLICITATION_TYPES = ["animation", "partenariat", "autre"] as const;

/**
 * 🔴 Nom du champ honeypot, PARTAGÉ entre `SolicitationForm` (client) et `submitSolicitation`
 * (serveur) — trouvé en revue (Blind Hunter + Acceptance Auditor) : deux copies indépendantes
 * de cette constante divergeraient EN SILENCE (lint/typecheck/build tous verts), désactivant
 * la garde anti-spam sans que rien ne le signale. Même doctrine que `SOLICITATION_TYPES` :
 * une seule source pour un consommateur client ET un consommateur serveur.
 * Nom volontairement peu générique (ni `website`/`url`/`company`) pour réduire le risque
 * qu'un navigateur l'auto-remplisse pour un vrai visiteur (risque résiduel documenté, AC3).
 */
export const HONEYPOT_FIELD = "sujetSecondaire";

/**
 * Libellés publics des types de demande — PARTAGÉS entre le formulaire et le corps de
 * l'e-mail de notification (trouvé en revue, Blind Hunter finding #10 : recopiés
 * indépendamment dans les deux, risque de divergence silencieuse identique à celui du
 * honeypot ci-dessus).
 */
export const SOLICITATION_TYPE_LABELS: Record<(typeof SOLICITATION_TYPES)[number], string> = {
  animation: "Animation",
  partenariat: "Partenariat",
  autre: "Autre",
};

const trimmedText = z.string().trim();

export const solicitationInputSchema = z.object({
  /**
   * « Nom ou structure » (UX-DR14, epics.md) — un seul champ, pas deux (voir schema.ts).
   * ⚠️ `.min()` compte des unités de code, pas des caractères visibles : un nom fait uniquement
   * de caractères sans largeur passerait la borne — d'où le `refine` en plus, patron `partner.name`
   * (finding de revue de la Story 4.1).
   */
  name: trimmedText
    .min(2, "Le nom (ou la structure) doit faire au moins 2 caractères.")
    .max(120, "Le nom (ou la structure) ne peut pas dépasser 120 caractères.")
    .refine((value) => !visiblementVide(value), {
      message: "Le nom ne peut pas être composé uniquement de caractères invisibles.",
    }),
  /**
   * Email du demandeur — sert aussi de `replyTo` à la notification (AC4).
   * ⚠️ `.trim()` explicite via `z.preprocess`, trouvé manquant en revue (Blind Hunter) :
   * `name`/`message` passent par `trimmedText`, mais `z.email()` seul ne trime pas — un
   * copier-coller avec un espace ou un saut de ligne en fin (piège courant) aurait été
   * rejeté au lieu d'être nettoyé silencieusement comme les autres champs texte.
   */
  email: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z
      .email({
        error: "Oups, il manque ton email pour qu'on puisse te répondre.",
      })
      // Même borne que le `CHECK solicitation_email_valide` de `schema.ts` (RFC 5321 §4.5.3.1.3).
      .max(254, "Cette adresse email est trop longue."),
  ),
  requestType: z.enum(SOLICITATION_TYPES, {
    error: "Choisis le type de demande qui correspond le mieux.",
  }),
  /**
   * Bornée à 5000 caractères, **même valeur que le `CHECK` de `schema.ts`** — la base et le
   * schéma expriment la même règle en deux langages (patron `photo_caption_valide`, 4.3).
   */
  message: trimmedText
    .min(1, "Oups, il manque ton message pour qu'on sache ce que tu veux nous dire.")
    .max(5000, "Le message est trop long (5000 caractères maximum).")
    .refine((value) => !visiblementVide(value), {
      message: "Le message ne peut pas être composé uniquement de caractères invisibles.",
    }),
  /**
   * 🔴 GARDE RGPD — pas un `z.literal(true)` sec : le message doit rester humain (UX-DR18).
   * Revérifiée côté serveur dans `submitSolicitation` (AC3) même si le client l'a déjà fait.
   */
  consentGiven: z.boolean().refine((value) => value === true, {
    message:
      "Coche la case de consentement pour qu'on ait le droit de te répondre — c'est le RGPD qui l'exige.",
  }),
});

export type SolicitationInput = z.infer<typeof solicitationInputSchema>;
