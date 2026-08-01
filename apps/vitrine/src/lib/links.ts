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
 * est une vraie URL http(s). Les routes internes (« /agenda »…) restent de simples
 * ancres : pas d'onglet vide, pas d'annonce trompeuse (review 1.4 #1). Les `mailto:`
 * ne sont pas « sortants » non plus.
 * (Promu depuis MobileMenu en Story 1.5 pour partage header/footer — Garde-fou n°3.)
 *
 * ⚠️ NE PAS RENOMMER NI SUPPRIMER — deux consommateurs HORS RENDU en dépendent, et
 * leur rupture serait silencieuse : `lib/schemas/partner.ts` (qui exige en base la
 * forme littérale que cette fonction sait reconnaître) et `server/db/schema.ts`
 * (invariant `CHECK` documenté). La Story 5.5 s'appuie dessus, elle ne la remplace pas.
 */
export function isExternalUrl(href: string) {
  return /^https?:\/\//.test(href);
}

/**
 * Les trois natures possibles d'une destination — Story 5.5.
 *
 *   · `externe`  → vraie URL http(s) : nouvel onglet + `rel` sûr + icône VISIBLE + annonce SR
 *   · `interne`  → un vrai lien qui ne sort pas du site : route `/…` (via `next/link`)
 *                  ou `mailto:` (via un `<a>` SIMPLE — surtout PAS `next/link`, qui n'est
 *                  fait que pour les routes). Aucune annonce « nouvel onglet ».
 *   · `absente`  → il n'y a PAS de destination. On ne rend alors AUCUN lien.
 */
export type Destination = "externe" | "interne" | "absente";

/**
 * Sentinelle d'une destination non renseignée — Story 5.5.
 *
 * 🔴 LA CHAÎNE VIDE, ET SURTOUT PAS `"#"`. Trois raisons :
 *   ① `#` est une ancre LÉGITIME ailleurs sur ce site (le skip-link vise `#content`,
 *     Story 1.6) : en faire une sentinelle rendrait la règle indécidable ;
 *   ② `<a href="#">` est un lien ACTIF qui remonte en haut de page — c'était le défaut
 *      R2, resté en place de la Story 1.5 à la 5.5 ;
 *   ③ la Story 6.13 fera de ce fichier un LECTEUR de la table `site_setting` : le signal
 *      naturel d'une valeur non saisie y sera une colonne VIDE, pas la chaîne « # ».
 */
export const DESTINATION_ABSENTE = "";

/**
 * Classe une destination. C'est le SEUL endroit du site qui décide de ce que rend un
 * lien — avant la Story 5.5, sept composants re-dérivaient la question chacun de son côté.
 *
 * 🔴 `"#"` ET LES CHAÎNES D'ESPACES SONT TRAITÉS COMME ABSENTS, et ce n'est pas de la
 * complaisance : la Story 6.13 fera SAISIR ces valeurs par un bénévole depuis un
 * back-office. Une chaîne « &nbsp; » collée par mégarde ne doit pas fabriquer un lien
 * mort — un espace saisi n'est pas une destination.
 */
export function classerDestination(href: string): Destination {
  const cible = href.trim();
  if (cible === "" || cible === "#") return "absente";
  return isExternalUrl(cible) ? "externe" : "interne";
}
