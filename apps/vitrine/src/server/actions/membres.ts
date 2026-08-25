"use server";

import { and, asc, eq, isNull } from "drizzle-orm";

import { cheminPortrait, nomFichierPortrait } from "../../lib/portraits";
import { memberInputSchema } from "../../lib/schemas/member";
import { exigerRoleAction } from "../auth/guard";
import { db } from "../db/client";
import { MEMBRES_MAX } from "../db/queries/members";
import { member } from "../db/schema";
import { normaliserPortrait, supprimerMedia, type EchecMedia } from "../medias";
import {
  erreursParChamp,
  identifiant,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * Server Actions des membres du back-office (Story 6.10, FR35, FR22, AR-API1, AR-DB4).
 *
 * Le patron de saisie est celui d'`actions/agenda.ts` (6.3), `actions/galerie.ts` (6.4),
 * `actions/partenaires.ts` (6.5) puis `actions/ateliers.ts` (6.9), repris **littéralement** :
 * `await exigerRoleAction("admin_site")` en PREMIÈRE LIGNE de chaque action, retour discriminé, `identifiant`
 * sur tout `id` reçu, aucun `revalidateTag` (les pages publiques sont `force-dynamic`, il n'y a
 * rien à invalider — fait mesuré au cadrage de l'Epic 6, et `check:docs` a une règle qui le
 * tient).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUI EST PROPRE À CE DOMAINE : LA DONNÉE EST **PERSONNELLE**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Les cinq autres surfaces manipulent des faits de l'association ; celle-ci manipule des
 * personnes. Deux conséquences qui se lisent dans ce fichier :
 *
 *   ① **LA SUPPRESSION EST DURE, ET ELLE EMPORTE LE FICHIER.** Ce n'est pas du ménage, c'est
 *      le **droit à l'effacement** (RGPD, NFR5). Un portrait qui survivrait à la suppression
 *      d'un membre serait une donnée personnelle conservée sans base légale — et, comme il
 *      n'est plus référencé par aucune ligne, **aucun écran ne permettrait de le retrouver
 *      pour l'effacer**. C'est le pire des deux mondes.
 *   ② **RIEN N'EST COLLECTÉ QUI NE SOIT RENDU.** `analyserChamps` ne lit que le prénom et le
 *      rôle. Ajouter un champ ici, ce n'est pas ajouter une fonctionnalité : c'est collecter
 *      une donnée personnelle de plus.
 *
 * ⚠️ Le volet FICHIER est celui des partenaires (6.5), repris tel quel : remplacement,
 * retrait, concurrence optimiste sur la colonne, ordre ligne-puis-fichier. ⚠️ **Ce qui n'est
 * PAS repris**, et c'est une différence réelle : la garde `estLogoDuVolume` de 6.5, qui
 * protégeait les quatre logos versionnés dans `public/`. **Aucun portrait ne vit dans
 * `public/` et il n'y en aura pas** — cette garde n'aurait rien à protéger, et l'écrire
 * ferait croire à un cas qui n'existe pas (voir l'en-tête de `lib/portraits.ts`).
 */

/**
 * Nom lisible du champ derrière chaque contrainte de la table `member`.
 *
 * ⚠️ TABLE PROPRE À CE DOMAINE, et c'est le point de l'extraction de `_commun.ts` : le
 * traducteur est partagé, sa table ne l'est pas.
 *
 * 🔴 LES QUATRE NOMS SONT CEUX DE LA MIGRATION `0011`, VÉRIFIÉS DANS LE `.sql` GÉNÉRÉ. Une
 * contrainte absente de cette table retombe sur un message générique qui **ne nomme aucun
 * champ** — c'est le défaut trouvé en revue de la 6.3, où huit contraintes sur dix y tombaient.
 */
const CHAMP_PAR_CONTRAINTE: Record<string, string> = {
  member_prenom_valide: "le prénom",
  member_role_valide: "le rôle",
  member_portrait_valide: "le portrait",
};

/**
 * Cas particuliers : contraintes dont le message ne se déduit PAS du nom d'un champ.
 *
 * ⚠️ `member_portrait_unique` est un **`23505`**, pas un `23514` — il est traité plus bas, dans
 * `messageErreurBase`. Cette table-ci ne sert qu'aux `CHECK`.
 *
 * 🔴 DÉFAUT RÉEL TROUVÉ EN REVUE (Blind Hunter), ET IL ÉTAIT DU **CODE MORT**. La première
 * version rangeait `member_portrait_unique` ICI, avec un message soigné qui **n'aurait jamais
 * été affiché** : `_commun.ts` ne consulte cette table que dans la branche `code === "23514"`
 * (violation de `CHECK`), or un `uniqueIndex` lève un **`23505`**, dont la branche rend un
 * message générique fixe. MESURÉ :
 *   `ERROR:  23505: duplicate key value violates unique constraint "member_portrait_unique"`
 * ⚠️ Et `actions/partenaires.ts` porte **exactement cet avertissement** pour
 * `partner_logo_unique`, trente lignes au-dessus de l'endroit dont ce fichier reprend le
 * patron : le patron a été repris, l'avertissement non.
 */
const CAS_PARTICULIERS: Record<string, string> = {};

/** Traducteur partagé (`_commun.ts`), appliqué à la table de CE domaine. */
function messageErreurBase(erreur: unknown): string {
  const details = erreur as { code?: string; constraint_name?: string; constraint?: string };
  // 🔴 L'UNICITÉ DU PORTRAIT MÉRITE SA PHRASE : le message générique de `_commun.ts` (« Cet
  // élément existe déjà ») ne dirait pas QUOI, et le bénévole chercherait un doublon de prénom.
  // Ce cas ne peut pas naître du back-office (chaque téléversement génère son propre UUID) mais
  // bien d'une restauration partielle ou d'un `UPDATE` direct.
  if (
    details.code === "23505" &&
    (details.constraint_name ?? details.constraint) === "member_portrait_unique"
  ) {
    return (
      "Ce portrait est déjà rattaché à un autre membre. Téléversez-en une copie plutôt que de " +
      "partager le même fichier : sinon, supprimer l'une des deux fiches ferait disparaître le " +
      "portrait de l'autre."
    );
  }
  return traduireErreurBase(erreur, CHAMP_PAR_CONTRAINTE, CAS_PARTICULIERS);
}

/**
 * Messages d'échec du téléversement, un par motif. Table EXHAUSTIVE par construction
 * (`Record<EchecMedia["motif"], string>`) : ajouter un motif sans son message ferait échouer
 * le typecheck.
 *
 * ⚠️ Ils sont écrits pour un bénévole, pas pour un développeur — et ils disent tous
 * explicitement **ce qui a été conservé**, parce que la première question après un échec de
 * téléversement est « est-ce que j'ai cassé quelque chose ? ».
 */
const MESSAGE_ECHEC_PORTRAIT: Record<EchecMedia["motif"], string> = {
  illisible:
    "Ce fichier n'est pas une image que le site sait lire. Vérifiez que vous avez bien choisi " +
    "la photo (JPEG, PNG, WebP ou AVIF).",
  svg:
    "Les fichiers .svg ne sont pas acceptés, pour des raisons de sécurité — et ce n'est de " +
    "toute façon pas un format de photo. Envoyez un JPEG ou un PNG.",
  format: "Ce format d'image n'est pas accepté. Formats acceptés : JPEG, PNG, WebP, AVIF.",
  dimensions:
    "Cette image est démesurément grande (plus de 60 millions de pixels). Rien n'a été " +
    "enregistré — réexportez-la depuis votre téléphone ou votre ordinateur, puis réessayez.",
  volume:
    "Le dossier des médias du site est introuvable (variable MEDIA_DIR). Rien n'a été " +
    "enregistré — signalez-le, c'est un réglage du serveur.",
  ecriture:
    "L'enregistrement du fichier a échoué. Rien n'a été conservé, vous pouvez réessayer.",
};

/** Ce que l'écran reçoit après un téléversement de portrait réussi. */
export type PortraitEnregistre = {
  /** Valeur stockée en base (`/medias/portraits/<uuid>.webp`). */
  portrait: string;
  largeur: number;
  hauteur: number;
  /**
   * 🔴 La source était plus petite que la boîte carrée : elle n'a **pas** été agrandie, donc
   * ce portrait sera moins net que ses voisins. **L'écran le DIT** — doctrine R23 : avertir,
   * jamais corriger dans le dos.
   */
  plusPetitQueLaBoite: boolean;
  /**
   * 🔴 Le fichier produit est un **FILET** : une source très allongée ressort minuscule dans
   * sa plus petite dimension, et le cadre carré devrait l'étirer pour la remplir. Deux
   * avertissements DISTINCTS et non un seul booléen : « trop petit » et « trop étiré » sont
   * deux faits différents, et le second ne se déduit pas du premier (leçon 6.5).
   */
  filet: boolean;
};

/**
 * Lit les champs d'un formulaire de membre et les valide.
 *
 * ⚠️ `portrait`, `sortOrder` et `isPublished` sont OMIS du schéma, et **l'omission est la
 * garde** : c'est elle qui empêche un POST direct de les réécrire au passage. Chacun a sa
 * propre action — ce qui rend par construction impossible la dette **R35** (l'écrasement
 * silencieux d'un `isPublished` basculé depuis la liste pendant qu'un formulaire était ouvert).
 *
 * 🔴 ET C'EST PLUS FORT ENCORE POUR `portrait` : le laisser dans le schéma du formulaire
 * permettrait de faire pointer un membre vers le fichier d'un AUTRE par un simple POST — le
 * `CHECK` de forme l'accepterait (le chemin est bien formé), et seule l'unicité l'attraperait,
 * au mieux. La valeur ne vient donc **jamais** du formulaire : elle est fabriquée par le
 * serveur dans `remplacerPortraitMembre`.
 */
function analyserChamps(formData: FormData) {
  return memberInputSchema
    .omit({ portrait: true, sortOrder: true, isPublished: true })
    .safeParse({
      firstName: formData.get("firstName"),
      role: formData.get("role"),
    });
}

/**
 * Crée un membre, **en brouillon**.
 *
 * ⚠️ Le rang est CALCULÉ, jamais laissé au défaut `0` : sinon le départage se fait sur le
 * prénom puis l'UUID, et « monter d'un cran » n'aurait aucune prise — défaut corrigé dans la
 * galerie, puis chez les partenaires, puis dans les ateliers.
 */
export async function creerMembre(formData: FormData): Promise<ResultatAction<{ id: string }>> {
  await exigerRoleAction("admin_site");

  const analyse = analyserChamps(formData);
  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    const rang = await rangSuivant();
    const [ligne] = await db
      .insert(member)
      // 🔴 `isPublished: false` EXPLICITE : un membre naît invisible. Le laisser au défaut de
      // colonne marcherait aussi — l'écrire ici rend l'intention lisible à l'endroit où
      // quelqu'un serait tenté d'ajouter un champ au formulaire.
      .values({ ...analyse.data, portrait: null, sortOrder: rang, isPublished: false })
      .returning({ id: member.id });
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[creerMembre] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Le rang suivant.
 *
 * ⚠️ GLOBAL À LA TABLE, contrairement à `rangSuivant` des ateliers et des partenaires, qui
 * étaient propres à une famille ou une catégorie. L'équipe est une **liste unique** : rien ne
 * tranche avant `sort_order` dans son `ORDER BY`. Ce n'est pas une simplification par oubli,
 * c'est la conséquence directe de l'arbitrage « pas de catégorie bureau/bénévole ».
 */
async function rangSuivant(): Promise<number> {
  const lignes = await db.select({ sortOrder: member.sortOrder }).from(member);
  return lignes.reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1;
}

/**
 * Met à jour le prénom et le rôle.
 *
 * ⚠️ NE TOUCHE NI AU PORTRAIT, NI AU RANG, NI À LA PUBLICATION — chacun a son action (voir
 * `analyserChamps`).
 */
export async function enregistrerMembre(
  id: string,
  formData: FormData,
): Promise<ResultatAction<{ id: string }>> {
  await exigerRoleAction("admin_site");

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const analyse = analyserChamps(formData);
  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    const [ligne] = await db
      .update(member)
      .set(analyse.data)
      .where(eq(member.id, id))
      .returning({ id: member.id });

    if (!ligne) {
      return { ok: false, error: "Ce membre n'existe plus : il a été supprimé entre-temps." };
    }
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[enregistrerMembre] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Téléverse un portrait, ou remplace celui qui existe.
 *
 * 🔴 UNE SEULE ACTION POUR LES DEUX GESTES, et ce n'est pas une économie : le premier
 * téléversement est le cas où l'ancien vaut `null`. Deux actions distinctes auraient deux fois
 * la même concurrence optimiste à écrire, donc deux occasions de l'écrire différemment.
 *
 * 🔴 ORDRE : LIGNE D'ABORD, ANCIEN FICHIER ENSUITE. Les deux ordres possibles ne se valent pas
 * (raisonnement de `remplacerLogoPartenaire`, 6.5) :
 *   · ligne puis ancien fichier → si le retrait échoue, il reste un **octet orphelin** sur le
 *     volume : invisible du public, sans conséquence sur le rendu ;
 *   · ancien fichier puis ligne → la ligne pointerait un instant sur un fichier détruit,
 *     c'est-à-dire un **cadre cassé sur `/l-asso`**.
 * On préfère perdre l'octet.
 *
 * 🔴 ET SI L'ÉCRITURE EN BASE ÉCHOUE, C'EST LE **NOUVEAU** FICHIER QUI PART : il n'existe
 * alors aucune ligne pour le porter.
 *
 * ⚠️ ICI L'OCTET ORPHELIN N'EST PAS SEULEMENT DU DÉCHET, C'EST UNE DONNÉE PERSONNELLE : le
 * fichier est la photo de quelqu'un. Le journal le nomme donc explicitement pour qu'un
 * nettoyage manuel soit possible.
 */
export async function remplacerPortraitMembre(
  id: string,
  formData: FormData,
): Promise<ResultatAction<PortraitEnregistre>> {
  await exigerRoleAction("admin_site");

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, error: "Aucun fichier n'a été reçu. Réessayez de le sélectionner." };
  }

  // On relit l'ANCIEN portrait AVANT d'écrire quoi que ce soit : c'est lui qu'il faudra
  // retirer, et le lire après la mise à jour serait trop tard (la colonne porterait déjà le
  // nouveau).
  let ancien: string | null;
  try {
    const ligne = await db.query.member.findFirst({
      columns: { portrait: true },
      where: (table, { eq: egal }) => egal(table.id, id),
    });
    if (!ligne) {
      return { ok: false, error: "Ce membre n'existe plus : il a été supprimé entre-temps." };
    }
    ancien = ligne.portrait;
  } catch (erreur) {
    console.error("[remplacerPortraitMembre] Échec de la lecture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }

  // ── Le contenu décide, le nom vient du serveur, l'image est normalisée ─────────────
  const contenu = Buffer.from(await fichier.arrayBuffer());
  const normalisation = await normaliserPortrait(contenu);
  if (!normalisation.ok) {
    return { ok: false, error: MESSAGE_ECHEC_PORTRAIT[normalisation.echec.motif] };
  }

  const nouveau = cheminPortrait(normalisation.filename);

  try {
    // 🔴 CONCURRENCE OPTIMISTE SUR LE PORTRAIT — reprise du défaut trouvé en revue de la 6.5.
    // Sans elle, deux remplacements quasi simultanés sur le MÊME membre (deux onglets)
    // écriraient deux fichiers distincts — noms UUID, donc aucune collision, donc aucune
    // erreur — puis les deux `UPDATE` réussiraient. Le second écraserait `portrait`, et le
    // fichier du premier resterait sur le volume **référencé par aucune ligne**.
    //
    // ⚠️ `isNull` ET NON `eq(member.portrait, null)` : en SQL, `portrait = NULL` n'est jamais
    // VRAI — la comparaison rendrait la clause toujours fausse, donc l'action échouerait
    // systématiquement sur un membre SANS portrait, c'est-à-dire sur le cas nominal du
    // PREMIER téléversement. Le piège est silencieux : le typage TypeScript l'accepte.
    const [ligne] = await db
      .update(member)
      .set({ portrait: nouveau })
      .where(
        and(eq(member.id, id), ancien === null ? isNull(member.portrait) : eq(member.portrait, ancien)),
      )
      .returning({ id: member.id });

    if (!ligne) {
      // Deux causes, indiscernables d'ici et qui appellent la même réponse : la ligne a
      // disparu, ou son portrait a changé depuis notre lecture. Dans les deux cas le fichier
      // qu'on vient de poser n'a plus de porteur légitime — il part.
      await supprimerMedia(normalisation.filename);
      return {
        ok: false,
        error:
          "Ce membre a changé depuis l'affichage de cette page : il a été supprimé, ou son " +
          "portrait a été remplacé ailleurs. Rien n'a été enregistré — rechargez la page pour " +
          "repartir de l'état réel.",
      };
    }
  } catch (erreur) {
    console.error("[remplacerPortraitMembre] Échec de l'écriture en base :", erreur);
    // 🔴 LE NOUVEAU FICHIER PART AVEC L'ÉCHEC. Sans ça, chaque erreur d'écriture laisserait un
    // octet que plus aucune ligne ne référence, donc qu'aucun écran ne peut supprimer.
    await supprimerMedia(normalisation.filename);
    return { ok: false, error: messageErreurBase(erreur) };
  }

  await retirerFichier(ancien, "remplacerPortraitMembre");

  return {
    ok: true,
    data: {
      portrait: nouveau,
      largeur: normalisation.largeur,
      hauteur: normalisation.hauteur,
      plusPetitQueLaBoite: normalisation.plusPetitQueLaBoite,
      filet: normalisation.filet,
    },
  };
}

/**
 * Retire le portrait d'un membre **sans supprimer l'entrée**.
 *
 * ⚠️ CONSÉQUENCE À DIRE, PAS À DEVINER : le membre reste publié et reste sur `/l-asso` — sa
 * carte rend alors la **silhouette**, à la même place et à la même taille. Rien ne bouge dans
 * la grille. C'est précisément ce que le placeholder existe pour garantir.
 */
export async function retirerPortraitMembre(id: string): Promise<ResultatAction<undefined>> {
  await exigerRoleAction("admin_site");

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  // 🔴 ON RELIT L'ANCIEN PORTRAIT **AVANT** L'`UPDATE`, ET C'EST OBLIGATOIRE.
  // `returning({ portrait })` rendrait la valeur d'APRÈS la mise à jour, c'est-à-dire `null` :
  // on ne saurait alors plus quel fichier retirer, et chaque retrait laisserait un octet
  // orphelin sur le volume — silencieusement, puisque l'action aurait rendu `ok: true`.
  // ⚠️ `supprimerMembre`, lui, peut utiliser `returning` : un `DELETE` rend la ligne telle
  // qu'elle était.
  let ancien: string | null;
  try {
    const ligne = await db.query.member.findFirst({
      columns: { portrait: true },
      where: (table, { eq: egal }) => egal(table.id, id),
    });
    if (!ligne) return { ok: false, error: "Ce membre n'existe plus." };
    ancien = ligne.portrait;
  } catch (erreur) {
    console.error("[retirerPortraitMembre] Échec de la lecture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }

  if (ancien === null) {
    // Rien à faire, et ce n'est pas une erreur : l'état voulu est déjà atteint.
    return { ok: true, data: undefined };
  }

  try {
    // Concurrence optimiste, même raison que dans `remplacerPortraitMembre` : si le portrait a
    // changé depuis notre lecture, on ne veut ni détruire le fichier d'un autre, ni annoncer un
    // retrait qui n'a pas porté sur ce qu'on croyait.
    const [ligne] = await db
      .update(member)
      .set({ portrait: null })
      .where(and(eq(member.id, id), eq(member.portrait, ancien)))
      .returning({ id: member.id });

    if (!ligne) {
      return {
        ok: false,
        error:
          "Ce membre a changé depuis l'affichage de cette page : il a été supprimé, ou son " +
          "portrait a été modifié ailleurs. Rien n'a été retiré — rechargez la page.",
      };
    }
  } catch (erreur) {
    console.error("[retirerPortraitMembre] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }

  // La ligne ne référence plus le fichier : il peut partir. L'échec se journalise et ne remonte
  // pas — le portrait a bien disparu du site, c'est ce qui était demandé.
  await retirerFichier(ancien, "retirerPortraitMembre");
  return { ok: true, data: undefined };
}

/**
 * Publie ou dépublie un membre — **le geste NOMINAL de cet écran**.
 *
 * ⚠️ Dépublier ne supprime rien : *un retour au bureau se republie, il ne se ressaisit pas*
 * (AC d'`epics.md`). C'est pour cela que la suppression dure porte un libellé et une
 * confirmation entièrement distincts côté écran.
 */
export async function definirPublicationMembre(
  id: string,
  publier: boolean,
): Promise<ResultatAction<{ id: string }>> {
  await exigerRoleAction("admin_site");

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .update(member)
      .set({ isPublished: publier })
      .where(eq(member.id, id))
      .returning({ id: member.id });

    if (!ligne) return { ok: false, error: "Ce membre n'existe plus." };
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[definirPublicationMembre] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Supprime un membre — la ligne, **et son portrait**.
 *
 * 🔴 CE N'EST PAS DU MÉNAGE, C'EST LE **DROIT À L'EFFACEMENT** (RGPD, NFR5). Un portrait qui
 * survivrait à la suppression serait une donnée personnelle conservée sans base légale, et —
 * n'étant plus référencé par aucune ligne — **aucun écran ne permettrait de le retrouver pour
 * l'effacer**.
 *
 * 🔴 LIGNE D'ABORD, FICHIER ENSUITE (voir `remplacerPortraitMembre`).
 * ⚠️ L'ÉCHEC DU RETRAIT SE JOURNALISE ET NE REMONTE PAS : le membre a bien disparu du site,
 * c'est ce que le bénévole demandait. Lui rendre une erreur le ferait recliquer sur une ligne
 * qui n'existe plus. **Mais le journal nomme le fichier**, précisément parce qu'ici l'octet
 * restant est une photo de personne.
 *
 * ⚠️ Aucune clé étrangère ne référence `member` : rien d'autre ne s'oppose à ce `DELETE`.
 */
export async function supprimerMembre(id: string): Promise<ResultatAction<undefined>> {
  await exigerRoleAction("admin_site");

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .delete(member)
      .where(eq(member.id, id))
      .returning({ portrait: member.portrait });

    if (!ligne) return { ok: false, error: "Ce membre a déjà été supprimé." };

    await retirerFichier(ligne.portrait, "supprimerMembre");
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerMembre] Échec de la suppression :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * 🔴 LE SEUL ENDROIT QUI DÉTRUIT UN FICHIER DE PORTRAIT.
 *
 * ⚠️ Plus simple que son homologue `retirerFichierSiDuVolume` de 6.5, et **c'est un fait, pas
 * un raccourci** : là-bas il fallait distinguer les logos versionnés dans `public/` de ceux du
 * volume. Ici **toute** valeur non nulle est sur le volume (garanti par le `CHECK`
 * `member_portrait_valide` et par `estCheminPortraitValide`), donc il n'y a rien à distinguer.
 * `nomFichierPortrait` rend malgré tout `null` sur une valeur mal formée — défense en
 * profondeur, au cas où la colonne aurait été peuplée par un chemin qui contourne les deux.
 */
async function retirerFichier(portrait: string | null, appelant: string): Promise<void> {
  const nom = nomFichierPortrait(portrait);
  if (nom === null) return;
  const retire = await supprimerMedia(nom);
  if (!retire) {
    console.error(
      `[${appelant}] Fichier CONSERVÉ sur le volume : ${nom}. C'est un PORTRAIT, donc une ` +
        "donnée personnelle orpheline — sans effet sur le rendu, mais à supprimer à la main.",
    );
  }
}

/**
 * Renumérote l'équipe : la position dans `nouvelOrdre` devient le `sort_order`.
 *
 * ⚠️ GLOBAL À LA TABLE, contrairement aux ateliers (par famille) et aux partenaires (par
 * catégorie) : l'équipe est une liste unique, rien ne tranche avant `sort_order` dans son
 * `ORDER BY`. Il n'y a donc pas de paramètre de portée à valider ici — et il ne faut pas en
 * inventer un « par symétrie ».
 *
 * 🔴 ON RÉÉCRIT TOUT L'ORDRE, ON NE PERMUTE PAS DEUX LIGNES. Une permutation laisse intactes
 * les égalités existantes — or le cas nominal après un back-office qui laisse le défaut `0`
 * est « tout le monde à 0 », où le départage se fait sur le prénom puis l'UUID.
 *
 * ⚠️ EN UNE TRANSACTION : un ordre à moitié réécrit serait pire que pas d'ordre du tout.
 *
 * 🔴 CONCURRENCE OPTIMISTE — REPRISE D'UN DÉFAUT RÉEL TROUVÉ EN REVUE DE LA 6.4. Chaque ligne
 * de l'écran porte son propre `useTransition` et recalcule l'ordre à partir du MÊME tableau
 * figé au rendu serveur : sans cette comparaison, deux clics rapides partent tous deux de
 * l'état d'AVANT le premier, et le second annule silencieusement le premier — **deux
 * `ok: true`, un seul geste appliqué**.
 */
export async function reordonnerMembres(
  ordreAttendu: string[],
  nouvelOrdre: string[],
): Promise<ResultatAction<{ nombre: number }>> {
  await exigerRoleAction("admin_site");

  if (nouvelOrdre.length === 0) return { ok: true, data: { nombre: 0 } };

  if (!nouvelOrdre.every((id) => identifiant.safeParse(id).success)) {
    return { ok: false, error: "La liste des membres n'est pas valide. Rechargez la page." };
  }
  // Un doublon ferait qu'une ligne prendrait deux rangs et qu'une autre n'en prendrait aucun :
  // la liste ne serait plus une permutation.
  if (new Set(nouvelOrdre).size !== nouvelOrdre.length) {
    return { ok: false, error: "La liste des membres contient un doublon. Rechargez la page." };
  }
  // `nouvelOrdre` doit être une PERMUTATION d'`ordreAttendu`, pas une liste quelconque : sinon
  // un POST direct pourrait renuméroter des lignes qui n'étaient pas à l'écran.
  if (
    ordreAttendu.length !== nouvelOrdre.length ||
    [...ordreAttendu].sort().join() !== [...nouvelOrdre].sort().join()
  ) {
    return { ok: false, error: "La liste des membres n'est pas valide. Rechargez la page." };
  }

  try {
    await db.transaction(async (tx) => {
      // ══════════════════════════════════════════════════════════════════════════════════
      // 🔴 LA RELECTURE EST **DANS** LA TRANSACTION, **ET ELLE VERROUILLE** — DÉFAUT TROUVÉ
      //    EN REVUE (Acceptance Auditor), ET LE PREMIER CORRECTIF ÉVIDENT N'AURAIT RIEN FERMÉ.
      // ══════════════════════════════════════════════════════════════════════════════════
      //
      // La première version relisait l'ordre **avant** d'ouvrir la transaction. L'AC de la
      // story et le piège n°6 disaient pourtant « relire l'ordre courant DANS la transaction » :
      // le texte et le code divergeaient.
      //
      // 🔴 MAIS DÉPLACER LE `SELECT` N'AURAIT PAS SUFFI, ET C'EST LE POINT. Mesuré :
      // `SHOW transaction_isolation` → **`read committed`**. À ce niveau, un `SELECT` nu ne
      // prend **aucun verrou** : deux transactions simultanées liraient toutes deux l'état
      // d'avant, passeraient toutes deux le contrôle, et la seconde écraserait la première —
      // exactement le défaut que cette garde existe pour empêcher (trouvé en revue de la 6.4).
      // Un correctif qui se contente de déplacer la ligne rendrait l'AC littéralement vrai
      // **tout en laissant la fenêtre ouverte** : il achèterait la conformité du texte, pas la
      // propriété.
      //
      // ⇒ `FOR UPDATE`. La seconde transaction **bloque** sur les lignes verrouillées jusqu'au
      // `COMMIT` de la première, puis relit l'état **mis à jour**, constate l'écart et se fait
      // rejeter proprement. C'est ce qui ferme réellement la fenêtre.
      //
      // ⚠️ **LES DEUX AUTRES ÉCRANS DE RÉORDONNANCEMENT GARDENT CETTE FENÊTRE** :
      // `reordonnerAteliers` (6.9) et `reordonnerPartenaires` (6.5) relisent hors transaction
      // et sans verrou. Ce n'est pas corrigé ici — on ne change pas le comportement d'une story
      // mergée depuis une autre story (doctrine 2.7) — mais ce n'est pas tu non plus : c'est
      // une dette, routée vers la **rétro de l'Epic 6**, seule destination vivante puisque
      // aucune story restante ne touche ces deux écrans.
      //
      // ⚠️ `limit` : la MÊME borne que l'écran (`MEMBRES_MAX`). Sans elle, la relecture portait
      // sur TOUTE la table alors qu'`ordreAttendu` vient d'un écran borné à 200 : au-delà de
      // 200 membres, les longueurs n'auraient jamais coïncidé et le réordonnancement aurait
      // échoué **systématiquement**, avec un message accusant une modification concurrente qui
      // n'a pas eu lieu. Cas absurde pour une association, incohérence réelle quand même —
      // relevée en revue (Edge Case Hunter).
      const actuelles = await tx
        .select({ id: member.id })
        .from(member)
        .orderBy(asc(member.sortOrder), asc(member.firstName), asc(member.id))
        .limit(MEMBRES_MAX)
        .for("update");

      const inchange =
        actuelles.length === ordreAttendu.length &&
        actuelles.every((ligne, rang) => ligne.id === ordreAttendu[rang]);

      // ⚠️ On sort par une exception SENTINELLE et non par un `return` : un `return` depuis le
      // corps d'une transaction Drizzle la **valide** (`COMMIT`). Ici il n'y a encore rien
      // écrit, donc l'effet serait le même — mais le jour où une écriture précéderait ce
      // contrôle, un `return` la committerait en silence. L'exception, elle, garantit le
      // `ROLLBACK` quoi qu'il arrive.
      if (!inchange) throw new Error(CONFLIT_ORDRE);

      for (const [rang, id] of nouvelOrdre.entries()) {
        await tx.update(member).set({ sortOrder: rang }).where(eq(member.id, id));
      }
    });

    return { ok: true, data: { nombre: nouvelOrdre.length } };
  } catch (erreur) {
    if ((erreur as Error)?.message === CONFLIT_ORDRE) {
      return {
        ok: false,
        error:
          "L'équipe a changé depuis l'affichage de la page (un membre a été ajouté, supprimé " +
          "ou déplacé). Rechargez pour repartir de l'ordre réel — sinon ce changement en " +
          "écraserait un autre.",
      };
    }
    console.error("[reordonnerMembres] Échec de la renumérotation :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/** Sentinelle de sortie de transaction — voir `reordonnerMembres`. */
const CONFLIT_ORDRE = "__ORDRE_CHANGE__";

// ⚠️ NE RIEN EXPORTER D'AUTRE QUE DES FONCTIONS `async` DEPUIS CE FICHIER. Un module
// `"use server"` n'autorise que ça : une constante exportée ici casserait le `build` (et pas
// le typecheck — encore un cas où seul le build voit le défaut, leçon ⑴ de la 6.3). L'écran
// importe `PORTRAIT_COTE` depuis `lib/portraits.ts`, sa source.
