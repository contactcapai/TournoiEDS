/**
 * links.ts — URL externes centralisées + utilitaires de lien sortant de la vitrine.
 *
 * SOURCE UNIQUE des cibles externes (header ET footer la consomment).
 *
 * Sortants ⇒ TOUJOURS ouverts en nouvel onglet par l'appelant
 * (`target="_blank" rel="noopener noreferrer"` + texte SR « (nouvel onglet) »).
 *
 * ⚠️ Certaines cibles ne sont pas encore calibrées (modèle d'adhésion HelloAsso
 * non figé, invitation Discord à confirmer, comptes réseaux à fournir) → valeurs
 * PROVISOIRES (`"#"`), finalisées en Story 5.5. Ne pas afficher de montant/palier
 * sur le CTA « Nous rejoindre ». Un placeholder `"#"` reste une ancre inerte :
 * pas de nouvel onglet, pas d'annonce SR trompeuse (cf. `isExternalUrl`).
 */

/** Plateforme tournoi (domaine réel confirmé — architecture.md). Stable. */
export const TOURNOI_URL = "https://tournoi.esportdessacres.fr";

/** Adhésion HelloAsso — libellé neutre. TODO Story 5.5 : URL définitive. */
export const REJOINDRE_URL = "https://www.helloasso.com/";

/** Invitation Discord communauté (PAS la porte des dates). TODO Story 5.5 : invitation définitive. */
export const DISCORD_URL = "#";

/** Compte Instagram. TODO Story 5.5 : URL définitive. */
export const INSTAGRAM_URL = "#";

/** Compte X (ex-Twitter). TODO Story 5.5 : URL définitive. */
export const X_URL = "#";

/** Page LinkedIn. TODO Story 5.5 : URL définitive. */
export const LINKEDIN_URL = "#";

/** Email de contact public (cf. EXPERIENCE.md / maquette). Stable. */
export const CONTACT_EMAIL = "esportdessacres@gmail.com";

/**
 * Phrasé lecteur d'écran unifié pour un lien ouvrant un nouvel onglet.
 * Aligné sur la primitive LinkArrow (@repo/ui) → cohérent sur toute la vitrine.
 * (Promu depuis MobileMenu en Story 1.5 pour partage header/footer — Garde-fou n°3.)
 */
export const NEW_TAB_SR = " (nouvel onglet)";

/**
 * Un lien n'est « sortant » (nouvel onglet + annonce SR + icône) que si sa cible
 * est une vraie URL http(s). Les placeholders (« # », finalisés Story 5.5) et les
 * routes internes (« /agenda »…) restent de simples ancres : pas d'onglet vide,
 * pas d'annonce trompeuse (review 1.4 #1). Les `mailto:` ne sont pas « sortants » non plus.
 * (Promu depuis MobileMenu en Story 1.5 pour partage header/footer — Garde-fou n°3.)
 */
export function isExternalUrl(href: string) {
  return /^https?:\/\//.test(href);
}
