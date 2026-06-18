/**
 * links.ts — URL externes centralisées de la vitrine.
 *
 * Sortants ⇒ TOUJOURS ouverts en nouvel onglet par l'appelant
 * (`target="_blank" rel="noopener noreferrer"` + texte SR « (nouvelle fenêtre) »).
 *
 * ⚠️ Certaines cibles ne sont pas encore calibrées (modèle d'adhésion HelloAsso
 * non figé, invitation Discord à confirmer) → valeurs PROVISOIRES, finalisées en
 * Story 5.5. Ne pas afficher de montant/palier sur le CTA « Nous rejoindre ».
 */

/** Plateforme tournoi (domaine réel confirmé — architecture.md). Stable. */
export const TOURNOI_URL = "https://tournoi.esportdessacres.fr";

/** Adhésion HelloAsso — libellé neutre. TODO Story 5.5 : URL définitive. */
export const REJOINDRE_URL = "https://www.helloasso.com/";

/** Invitation Discord communauté (PAS la porte des dates). TODO Story 5.5 : invitation définitive. */
export const DISCORD_URL = "#";
