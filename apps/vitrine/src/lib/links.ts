/**
 * links.ts — **utilitaires de lien** de la vitrine.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE FICHIER N'EST PLUS LA SOURCE DE VÉRITÉ DES DESTINATIONS — STORY 6.13
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Il s'est déclaré « SOURCE UNIQUE des cibles externes » de la Story 1.5 à la 6.13. Les six
 * destinations qu'il portait (`DISCORD_URL`, `INSTAGRAM_URL`, `X_URL`, `LINKEDIN_URL`,
 * `REJOINDRE_URL`, `CONTACT_EMAIL`) vivent désormais dans la table **`site_setting`** et se
 * saisissent au back-office (`/admin/reglages`). Elles se lisent par
 * **`server/db/queries/settings.ts` → `lireReglages()`**.
 *
 * ⚠️ **NE JAMAIS RÉINTRODUIRE UNE URL DE DESTINATION ICI, NI DANS UN COMPOSANT.** Deux sources
 * coexisteraient et divergeraient — c'est exactement ce que la 6.13 existe pour supprimer, et la
 * garde ⑪ de `gate:reglages` le mesure.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI CE MODULE N'EST PAS `server-only`, ALORS QUE LE LECTEUR L'EST
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * L'AC d'origine (`epics.md`) prescrivait *« lib/links.ts devient le lecteur server-only »*.
 * **Mesuré au cadrage de la 6.13 : c'est infaisable.** `MobileMenu.tsx` et
 * `SolicitationDialog.tsx` portent `'use client'` **et importent d'ici les UTILITAIRES**
 * (`NEW_TAB_SR`, `classerDestination`) : `import "server-only"` casserait le build. Ce ne sont
 * ni une base de données ni un secret — une constante de chaîne et deux fonctions pures — donc
 * les passer en props serait absurde.
 *
 * ⇒ Le fichier a été **SCINDÉ** : ce qui se **classe** reste ici et traverse la frontière
 * client ; ce qui se **lit en base** vit dans `server/db/queries/settings.ts`.
 *
 * Sortants ⇒ TOUJOURS ouverts en nouvel onglet par l'appelant
 * (`target="_blank" rel="noopener noreferrer"` + texte SR « (nouvel onglet) » + icône
 * VISIBLE `ExternalIcon`). Le comportement se DÉRIVE de `classerDestination()` : aucun
 * composant ne décide seul de ce qu'il rend.
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
 *   ③ ✅ **VÉRIFIÉ EN 6.13** : le signal d'une valeur non saisie est bien une **colonne
 *      `NULL`** de `site_setting`, jamais la chaîne « # ». `lireReglages()` la convertit en
 *      cette sentinelle, en un seul endroit, pour que les neuf sites de rendu n'aient aucune
 *      branche de plus à écrire.
 */
export const DESTINATION_ABSENTE = "";

/**
 * La page des tournois. **C'est une ROUTE INTERNE — Story 9.4.**
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 ELLE VALAIT `"https://tournoi.esportdessacres.fr"` JUSQU'AU 2026-08-14
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Ce n'était pas un choix mais une **absence** : la vitrine n'avait pas de page tournois, donc
 * elle envoyait ailleurs. Depuis les Stories 9.2 et 9.3, `/tournois` et `/tournois/<slug>`
 * existent — et l'ancienne plateforme n'est plus maintenue (arbitrage **A18** de la note
 * d'architecture : *« il n'y a plus rien dessus depuis ce fameux tournoi »*).
 *
 * 🔴 **CE CHANGEMENT DE VALEUR SUFFIT À RETIRER LES TROIS ATTRIBUTS DE LIEN SORTANT**
 * (`target="_blank"`, `ExternalIcon`, mention `NEW_TAB_SR`) chez **tous** ses consommateurs,
 * parce qu'aucun d'eux ne les décide : ils les DÉRIVENT de `classerDestination()` ci-dessous.
 * C'est exactement ce pour quoi la Story 5.5 a créé ce classificateur.
 * ⚠️ **MAIS ÇA NE SUFFIT PAS POUR LE LIEN DE NAVIGATION**, et c'est le piège de la 9.4 :
 * `SiteHeader` portait `external: true` **en littéral**, un drapeau qui n'est PAS dérivé et qui
 * choisit la branche de rendu de `MobileMenu.renderNavLink`. L'oublier aurait laissé un `<a>`
 * nu — sans `next/link`, sans `aria-current` — pendant que le témoin « plus d'icône sortante »
 * passait au vert. Mesuré avant/après : `aria-current="page"` sur `/tournois` valait **0**, il
 * vaut **2** (barre desktop + panneau mobile). La garde **⑧** de `gate:links` le tient.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 ELLE N'ENTRE JAMAIS DANS `site_setting`, ET LE MOTIF A CHANGÉ
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * La Story 6.13 l'avait déjà exclue, avec ce motif : *« c'est un domaine RÉEL et stable, il n'a
 * jamais été un placeholder »*. **Ce motif est mort avec cette story** — ce n'est plus un
 * domaine du tout. Le motif actuel est plus fort : c'est une **route de ce site**, donc un fait
 * du code, au même titre que `/agenda` ou `/partenaires`. La rendre saisissable au back-office
 * offrirait à un bénévole un moyen de casser la navigation du site depuis un formulaire.
 * ⚠️ La garde ⑪ de `gate:reglages` ne la surveille pas et n'a pas à le faire : elle vérifie que
 * les **six destinations saisissables** ont bien quitté ce fichier. `TOURNOI_URL` n'en a jamais
 * fait partie, et n'est plus une « destination » au sens de cette garde.
 */
export const TOURNOI_URL = "/tournois";

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
 * ⚠️ NE PAS RENOMMER NI SUPPRIMER — TROIS consommateurs HORS RENDU en dépendent, et
 * leur rupture serait silencieuse : `lib/schemas/partner.ts` et `lib/schemas/texte.ts`
 * (`urlHttpOptionnelle`, qui exige en base la forme littérale que cette fonction sait
 * reconnaître) et `server/db/schema.ts` (invariants `CHECK` documentés, dont les cinq
 * `site_setting_*_url_valide` posés en 6.13 avec le motif `^https?://`).
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
 * complaisance : depuis la Story 6.13, ces valeurs sont **SAISIES par un bénévole** dans
 * `/admin/reglages`. Zod refuse déjà au bord tout ce qui n'est pas une URL absolue en
 * `http(s)`, et ramène à `null` une chaîne visuellement vide — mais ce filet-ci reste le
 * dernier rempart du RENDU, pour une valeur arrivée par un chemin qui contournerait Zod
 * (`UPDATE` direct, restauration de sauvegarde). Un espace saisi n'est pas une destination.
 */
export function classerDestination(href: string): Destination {
  const cible = href.trim();
  if (cible === "" || cible === "#") return "absente";
  return isExternalUrl(cible) ? "externe" : "interne";
}
