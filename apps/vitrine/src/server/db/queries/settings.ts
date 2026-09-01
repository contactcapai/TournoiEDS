// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts` et les six autres familles de
// requêtes (garde-fou n°1 de la Story 1.7) : ce module lit la base, il ne doit jamais être
// atteint depuis un composant client.
//
// 🔴 ET C'EST PRÉCISÉMENT POURQUOI CE LECTEUR N'EST PAS DANS `lib/links.ts`. L'AC d'`epics.md`
// prescrivait *« lib/links.ts devient le lecteur server-only de site_setting »*. C'est
// INFAISABLE, et c'est mesuré : `MobileMenu.tsx` et `SolicitationDialog.tsx` portent
// `'use client'` et importent aussi les UTILITAIRES de `links.ts` (`NEW_TAB_SR`,
// `classerDestination`). Poser `server-only` là-bas casserait le build. Le fichier a donc été
// SCINDÉ — les utilitaires restent isomorphes, le lecteur vit ici, avec les six autres.
import "server-only";
import { cache } from "react";

import { db } from "../client";
import { DESTINATION_ABSENTE } from "../../../lib/links";
import { siteSetting } from "../schema";

/**
 * Lecture des réglages du site (Story 6.13, FR38).
 *
 * Emplacement conforme à `architecture.md` (l.515) : une famille de requêtes par domaine sous
 * `server/db/queries/`. Les composants ne requêtent JAMAIS eux-mêmes — la page (ou le layout)
 * appelle puis distribue en props (patron AC1 de la 3.2).
 */

/**
 * Les six réglages, **tels que le rendu les attend**.
 *
 * ⚠️ Les cinq URL sont des `string`, **jamais `null`** — voir `lireReglages`.
 */
export type Reglages = {
  discordUrl: string;
  instagramUrl: string;
  xUrl: string;
  linkedinUrl: string;
  helloassoUrl: string;
  contactEmail: string;
};

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 REPLI — CE QUE REND CE MODULE QUAND LA LIGNE N'EXISTE PAS
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * La migration `0012` insère la ligne, et `site_setting_ligne_unique` garantit qu'il n'y en a
 * jamais deux. Son absence signale donc une base à moitié restaurée, un `DELETE` direct, ou une
 * migration non jouée — trois cas anormaux.
 *
 * 🔴 ON NE LÈVE PAS POUR AUTANT, et c'est un arbitrage. Ce lecteur est appelé par le
 * `(public)/layout.tsx`, donc par le chrome des **5 pages** : une exception y rendrait le site
 * entier en erreur, pour une donnée dont l'absence a un comportement parfaitement défini.
 * Le repli est **exactement l'état d'avant cette story** — cinq destinations absentes (donc
 * aucun lien rendu, doctrine 5.5) et l'e-mail de contact réel. Le site reste **honnête** plutôt
 * que cassé.
 *
 * ⚠️ **C'est une LIMITE DÉCLARÉE, pas un filet silencieux** : la garde ⑤ de `gate:reglages`
 * l'éprouve en supprimant la ligne, et un `console.error` laisse une trace côté serveur — le
 * cas ne doit pas passer inaperçu de l'exploitant, seulement du visiteur.
 *
 * 🔴 ET CE REPLI NE COUVRE **QUE** LA LIGNE ABSENTE — PAS UNE BASE INJOIGNABLE.
 * Si Postgres ne répond pas, le `select` ci-dessous **lève**, et les 5 pages rendent une
 * erreur. C'est **délibéré et conforme** au reste du projet : les six autres familles de
 * requêtes ne rattrapent pas non plus, et une page qui prétendrait fonctionner sans base
 * afficherait un site vide en se taisant. La nuance : une ligne manquante est un état de
 * données *réparable et local*, une base injoignable est une panne d'infrastructure qui doit
 * se voir. ⚠️ Ne pas « uniformiser » en enveloppant d'un `try/catch` : ce serait exactement le
 * découplage silencieux que la dette R32 documente sur l'envoi d'e-mails.
 */
const REPLI: Reglages = {
  discordUrl: DESTINATION_ABSENTE,
  instagramUrl: DESTINATION_ABSENTE,
  xUrl: DESTINATION_ABSENTE,
  linkedinUrl: DESTINATION_ABSENTE,
  helloassoUrl: DESTINATION_ABSENTE,
  contactEmail: "esportdessacres@gmail.com",
};

/**
 * Lit les réglages du site.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 IL NE REND JAMAIS `null` POUR UNE URL — IL REND `DESTINATION_ABSENTE` (`""`)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * La colonne est nullable ; ce type ne l'est pas. Ce n'est pas de la commodité : les **neuf**
 * sites de rendu qui consomment ces valeurs sont écrits depuis la Story 5.5 pour dériver leur
 * comportement de `classerDestination()`, qui traite déjà `""` comme `"absente"`. Rendre
 * `string | null` ajouterait une branche à chacun des neuf — donc **neuf occasions d'oublier la
 * doctrine R2** (ni ancre morte, ni nouvel onglet, ni annonce « (nouvel onglet) » trompeuse), la
 * dette qui a vécu de la Story 1.5 à la 5.5 avec **huit ancres mortes par page** que personne
 * n'avait recomptées.
 *
 * ⚠️ La conversion se fait ICI et nulle part ailleurs : c'est le seul endroit du projet qui sait
 * qu'une colonne vide et une destination absente sont la même chose.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 `cache()` — MÉMOÏSATION **PAR REQUÊTE**, ET SURTOUT PAS UN CACHE APPLICATIF
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Le rendu d'une page publique appelle ce lecteur **deux fois** : le `(public)/layout.tsx` pour
 * le header et le footer, la page pour ses propres blocs (`/` en a deux, `/agenda` un). `cache()`
 * de React les fond en **une** requête SQL, **le temps d'une requête HTTP**, sans aucune
 * persistance entre deux visites.
 *
 * ⚠️ **CE N'EST NI `unstable_cache` NI `revalidateTag`.** Le projet n'a **aucun** cache
 * applicatif : les 5 pages publiques sont `force-dynamic` et relisent la base à chaque requête,
 * donc **il n'y a rien à invalider** — une saisie est visible au rechargement suivant. Écrire un
 * `revalidatePath` ici serait un **no-op** (fait mesuré au cadrage de l'Epic 6, et
 * `pnpm check:docs` porte une règle qui le tient). `cache()` ne relève pas de cette famille :
 * il ne survit pas à la requête, donc il n'a **pas de véhicule d'invalidation à avoir**.
 */
export const lireReglages = cache(async (): Promise<Reglages> => {
  const lignes = await db
    .select({
      discordUrl: siteSetting.discordUrl,
      instagramUrl: siteSetting.instagramUrl,
      xUrl: siteSetting.xUrl,
      linkedinUrl: siteSetting.linkedinUrl,
      helloassoUrl: siteSetting.helloassoUrl,
      contactEmail: siteSetting.contactEmail,
    })
    .from(siteSetting)
    .limit(1);

  const ligne = lignes[0];
  if (!ligne) {
    console.error(
      "site_setting est VIDE : la migration 0012 insère pourtant une ligne, et " +
        "site_setting_ligne_unique interdit d'en avoir plusieurs. Base à moitié restaurée, " +
        "migration non jouée, ou DELETE direct. Le site rend son état de repli.",
    );
    return REPLI;
  }

  return {
    discordUrl: ligne.discordUrl ?? DESTINATION_ABSENTE,
    instagramUrl: ligne.instagramUrl ?? DESTINATION_ABSENTE,
    xUrl: ligne.xUrl ?? DESTINATION_ABSENTE,
    linkedinUrl: ligne.linkedinUrl ?? DESTINATION_ABSENTE,
    helloassoUrl: ligne.helloassoUrl ?? DESTINATION_ABSENTE,
    contactEmail: ligne.contactEmail,
  };
});

/**
 * Lit les réglages **pour le formulaire du back-office**, en gardant les `null`.
 *
 * 🔴 DEUX LECTEURS, ET LA DIFFÉRENCE EST LE SUJET. Le rendu public veut « absente ou pas » ;
 * l'écran de saisie veut « ce qu'il y a réellement dans la colonne », pour que le champ soit
 * **vide** et non rempli d'une chaîne vide déguisée. Les fondre en un seul obligerait l'un des
 * deux à re-dériver ce que l'autre a effacé.
 *
 * ⚠️ Pas de `cache()` ici : cet écran l'appelle **une** fois, et le mémoïser masquerait une
 * relecture après écriture.
 *
 * ⚠️ ET IL SÉLECTIONNE LES SIX COLONNES, PAS `select()` NU. La valeur traverse la frontière
 * client (`ReglagesForm` porte `'use client'`) : un `select *` y enverrait `id` et surtout
 * `updated_at`, un objet `Date` sérialisé dans la charge utile RSC pour n'être lu par personne.
 * On n'envoie au navigateur que ce que le formulaire édite.
 */
export async function lireReglagesPourSaisie() {
  const lignes = await db
    .select({
      discordUrl: siteSetting.discordUrl,
      instagramUrl: siteSetting.instagramUrl,
      xUrl: siteSetting.xUrl,
      linkedinUrl: siteSetting.linkedinUrl,
      helloassoUrl: siteSetting.helloassoUrl,
      contactEmail: siteSetting.contactEmail,
      // ⚠️ Ajoutée par la 7.3, et SEULEMENT ici : `lireReglages()` (le rendu public) n'en
      // a pas besoin — c'est `getPhotoDuHero()` qui résout la photo, jointure comprise.
      // Remonter l'identifiant côté public ferait croire qu'il suffit, alors qu'il ne dit
      // rien de la publication du média.
      heroPhotoId: siteSetting.heroPhotoId,
    })
    .from(siteSetting)
    .limit(1);
  return lignes[0] ?? null;
}
