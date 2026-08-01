/**
 * links.ts — destinations externes centralisées + utilitaires de lien de la vitrine.
 *
 * SOURCE UNIQUE des cibles externes (header, footer et blocs de contenu la consomment).
 *
 * Sortants ⇒ TOUJOURS ouverts en nouvel onglet par l'appelant
 * (`target="_blank" rel="noopener noreferrer"` + texte SR « (nouvel onglet) » + icône
 * VISIBLE `ExternalIcon`). Le comportement se DÉRIVE de `classerDestination()` : aucun
 * composant ne décide seul de ce qu'il rend.
 *
 * 🔴 CINQ DESTINATIONS N'EXISTENT PAS ENCORE (dette R29, échéance GO-LIVE) — arbitrage
 * de Brice du 2026-07-31 : *« tu mets des placeholders que l'on renseignera à la toute
 * fin du projet »*. La Story 5.5 a livré le MÉCANISME, pas les destinations : une
 * destination absente ne rend AUCUN lien (ni ancre morte, ni nouvel onglet, ni annonce
 * trompeuse). Les poser le jour venu ne demande QUE de remplacer les valeurs ci-dessous ;
 * la Story 6.13 en fera ensuite un écran de saisie (`site_setting`), et ce fichier
 * deviendra un LECTEUR — ne jamais disperser d'URL en dur dans un composant.
 *
 * ⚠️ Ne pas afficher de montant ni de palier sur le CTA « Nous rejoindre » (FR18).
 */

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

/** Plateforme tournoi (domaine réel confirmé — architecture.md). Stable. */
export const TOURNOI_URL = "https://tournoi.esportdessacres.fr";

/**
 * Adhésion HelloAsso — libellé neutre. Destination absente (R29, go-live).
 *
 * 🔴 VALAIT `https://www.helloasso.com/` JUSQU'À LA STORY 5.5, et c'était le plus grave
 * des cinq cas : une vraie URL `https://`, donc classée SORTANTE, donc le CTA
 * « Nous rejoindre » du header s'ouvrait en nouvel onglet et s'annonçait au lecteur
 * d'écran — pour emmener le visiteur sur la page d'accueil générique d'un site tiers,
 * sans rapport avec l'association. Un placeholder est inerte ; ceci était ACTIF ET FAUX.
 */
export const REJOINDRE_URL = DESTINATION_ABSENTE;

/** Invitation Discord communauté (PAS la porte des dates, FR19). Absente — R29, go-live. */
export const DISCORD_URL = DESTINATION_ABSENTE;

/** Compte Instagram. Absent — R29, go-live. */
export const INSTAGRAM_URL = DESTINATION_ABSENTE;

/** Compte X (ex-Twitter). Absent — R29, go-live. */
export const X_URL = DESTINATION_ABSENTE;

/** Page LinkedIn. Absente — R29, go-live. */
export const LINKEDIN_URL = DESTINATION_ABSENTE;

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
