"use server";

import { asc, eq } from "drizzle-orm";

import { photoInputSchema } from "../../lib/schemas/photo";
import { requireAdmin } from "../auth/guard";
import { db } from "../db/client";
import { getMaxSortOrder } from "../db/queries/photos";
import { photo } from "../db/schema";
import { ecrireMedia, supprimerMedia, type EchecMedia } from "../medias";
import {
  erreursParChamp,
  identifiant,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * Server Actions de la galerie du back-office (Story 6.4, FR21, FR24, AR-API1, AR-DB4).
 *
 * 🔴 PREMIÈRE SURFACE DU PROJET QUI ÉCRIT SUR UN DISQUE. Tout le reste du back-office
 * n'écrit qu'en base, où une transaction annule proprement. Ici il y a **deux magasins**,
 * et leur ordre est une décision — écrite deux fois plus bas, parce qu'elle s'inverse selon
 * le sens de l'opération.
 *
 * Le patron de saisie est celui de `actions/agenda.ts` (6.3), repris littéralement :
 * `await requireAdmin()` en PREMIÈRE LIGNE de chaque action, retour discriminé, aucun
 * `revalidateTag` (les pages publiques sont `force-dynamic`, il n'y a rien à invalider —
 * mesuré au cadrage de l'Epic 6, et `check:docs` a une règle qui le fait tenir).
 */

/**
 * Nom lisible du champ derrière chaque contrainte de validité de la table `photo`.
 *
 * ⚠️ TABLE PROPRE À CE DOMAINE, et c'est le point de l'extraction de `_commun.ts` : le
 * traducteur est partagé, sa table ne l'est pas. Une table commune ferait qu'ajouter une
 * contrainte côté agenda toucherait la galerie.
 *
 * 🔴 `photo_alt_valide` ET NON `photo_alt_not_blank` : la migration `0008` de cette story a
 * renommé la contrainte en lui ajoutant son plafond. Garder l'ancien nom ici ferait
 * retomber le bénévole sur un message générique qui ne nomme aucun champ — c'est le défaut
 * trouvé en revue de la 6.3, où huit contraintes sur dix y tombaient.
 */
const CHAMP_PAR_CONTRAINTE: Record<string, string> = {
  photo_alt_valide: "la description",
  photo_caption_valide: "la légende",
  photo_filename_safe: "le nom du fichier",
};

/** Traducteur partagé (`_commun.ts`), appliqué à la table de CE domaine. */
function messageErreurBase(erreur: unknown): string {
  const message = traduireErreurBase(erreur, CHAMP_PAR_CONTRAINTE);
  // La seule clé étrangère de `photo` est l'événement : le nommer évite de faire chercher.
  return (erreur as { code?: string }).code === "23503"
    ? "L'événement choisi n'existe plus. Rechargez la page et choisissez-en un autre."
    : message;
}

/**
 * 🔴 CE QU'UN REFUS DE FICHIER DIT AU BÉNÉVOLE — et surtout ce qu'il ne dit PAS.
 *
 * Aucun de ces messages n'expose de chemin système : un « ENOENT:
 * /repo/apps/vitrine/medias/x.avif » divulguerait l'arborescence du conteneur, exactement
 * ce que la route de service refuse déjà de faire. Le diagnostic vit dans les logs serveur.
 *
 * ⚠️ Le cas `volume` NOMME la variable d'environnement, et c'est délibéré : c'est le seul
 * de la liste qu'un bénévole ne peut pas corriger lui-même, donc le seul où le message doit
 * donner à la personne qui l'aidera de quoi chercher.
 */
const MESSAGE_ECHEC_MEDIA: Record<EchecMedia["motif"], string> = {
  illisible:
    "Ce fichier n'est pas une image que le site sait lire. Vérifiez que vous avez bien choisi une photo (JPEG, PNG, WebP ou AVIF).",
  svg: "Les fichiers .svg ne sont pas acceptés dans la galerie, pour des raisons de sécurité. Enregistrez la photo en JPEG ou en PNG.",
  format: "Ce format d'image n'est pas accepté. Formats acceptés : JPEG, PNG, WebP, AVIF.",
  dimensions:
    "Cette image est démesurément grande (plus de 100 millions de pixels). Aucun appareil photo n'en produit d'aussi grandes : le fichier est probablement anormal. Rien n'a été enregistré.",
  volume:
    "Le dossier des photos du site est introuvable (variable MEDIA_DIR). Rien n'a été enregistré — signalez-le, c'est un réglage du serveur.",
  ecriture:
    "L'enregistrement du fichier a échoué. Rien n'a été conservé, vous pouvez réessayer.",
};

/** Ce que l'écran reçoit après un téléversement réussi. */
export type PhotoTeleversee = {
  id: string;
  /** Nom généré par le SERVEUR — l'écran l'affiche pour que la photo soit identifiable. */
  filename: string;
};

/**
 * Téléverse **UN** fichier et crée sa ligne `photo` en brouillon.
 *
 * 🔴 UN FICHIER PAR APPEL, ET C'EST UNE DÉCISION DE CONCEPTION, PAS UNE SIMPLIFICATION.
 * Une Server Action refuse **1 Mo par défaut** (`next.config.ts` remonte la borne, mais
 * elle reste par REQUÊTE) : huit photos de 4 Mo dans un seul envoi dépasseraient n'importe
 * quelle valeur raisonnable, et le `413` tomberait **avant** le corps de l'action — donc
 * avant `requireAdmin()`, avant Zod, avant tout message écrit par nous. L'écran boucle donc
 * et appelle cette action une fois par fichier.
 * ⚠️ CONTREPARTIE ASSUMÉE : le lot n'est pas atomique. Un échec au 5ᵉ fichier laisse quatre
 * photos créées — en BROUILLON, donc invisibles du public. L'écran le DIT, il ne le laisse
 * pas deviner.
 *
 * 🔴 ON VALIDE AVANT D'ÉCRIRE (`ecrireMedia` refuse sans poser un octet), ET SI L'INSERTION
 * ÉCHOUE APRÈS L'ÉCRITURE, LE FICHIER EST RETIRÉ. C'est l'inverse de l'ordre de la
 * suppression, et pour une raison exacte : ici il n'existe encore AUCUNE ligne pour porter
 * ce fichier, donc le laisser produirait un octet que plus aucun écran ne pourrait
 * atteindre — invisible, et croissant.
 */
export async function televerserPhoto(formData: FormData): Promise<ResultatAction<PhotoTeleversee>> {
  await requireAdmin();

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, error: "Aucun fichier n'a été reçu. Réessayez de le sélectionner." };
  }

  const alt = String(formData.get("alt") ?? "");
  const caption = String(formData.get("caption") ?? "");
  const eventIdBrut = String(formData.get("eventId") ?? "");
  const eventId = eventIdBrut === "" ? null : eventIdBrut;

  if (eventId !== null && !identifiant.safeParse(eventId).success) {
    return { ok: false, error: "L'événement choisi n'est pas valide. Rechargez la page." };
  }

  // ── ① Le rang est CALCULÉ, jamais laissé au défaut `0` ────────────────────────────
  // Sinon le départage se fait sur un UUID aléatoire et « organiser » n'a aucune prise sur
  // les 8 photos de la home (voir `getMaxSortOrder`).
  let sortOrder: number;
  try {
    const maximum = await getMaxSortOrder();
    sortOrder = maximum === null ? 0 : maximum + 1;
  } catch (erreur) {
    console.error("[televerserPhoto] Échec de la lecture du rang :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }

  // ── ② La validation des TEXTES précède l'écriture du fichier ──────────────────────
  // 🔴 L'ORDRE COMPTE : un `alt` refusé ne doit pas laisser d'octet sur le volume. On valide
  // donc tout ce qui peut l'être avant de toucher au disque. `filename` est provisoire ici
  // (le vrai nom vient du serveur, après lecture du contenu) : on re-valide l'objet COMPLET
  // une fois le fichier écrit, ce qui est la seule analyse dont le résultat est utilisé.
  const preAnalyse = photoInputSchema
    .omit({ filename: true })
    .safeParse({ alt, caption, eventId, sortOrder, isPublished: false });

  if (!preAnalyse.success) {
    return {
      ok: false,
      error: preAnalyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(preAnalyse.error.issues),
    };
  }

  // ── ③ Le type vient du CONTENU, le nom vient du SERVEUR ───────────────────────────
  const contenu = Buffer.from(await fichier.arrayBuffer());
  const ecriture = await ecrireMedia(contenu);
  if (!ecriture.ok) {
    return { ok: false, error: MESSAGE_ECHEC_MEDIA[ecriture.echec.motif] };
  }

  // ── ④ La ligne, et le retrait du fichier si elle échoue ───────────────────────────
  const analyse = photoInputSchema.safeParse({
    filename: ecriture.filename,
    alt,
    caption,
    eventId,
    sortOrder,
    isPublished: false,
  });

  if (!analyse.success) {
    // Ne devrait pas arriver : `filename` est fabriqué pour satisfaire la liste blanche, et
    // les textes viennent d'être validés. Si ça arrive quand même, c'est une divergence
    // entre la fabrique de nom et le schéma — elle mérite une trace ET le retrait du fichier.
    console.error("[televerserPhoto] Nom généré refusé par le schéma :", ecriture.filename);
    await supprimerMedia(ecriture.filename);
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    const [ligne] = await db.insert(photo).values(analyse.data).returning({ id: photo.id });
    return { ok: true, data: { id: ligne.id, filename: ecriture.filename } };
  } catch (erreur) {
    console.error("[televerserPhoto] Échec de l'écriture en base :", erreur);
    // 🔴 LE FICHIER PART AVEC L'ÉCHEC. Sans ça, chaque erreur d'insertion laisserait un
    // octet que plus aucune ligne ne référence, donc qu'aucun écran ne peut supprimer.
    await supprimerMedia(ecriture.filename);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Met à jour la description, la légende et le rattachement d'une photo.
 *
 * ⚠️ NE TOUCHE NI AU FICHIER NI AU RANG. Remplacer l'image d'une photo existante
 * signifierait écrire un second fichier et retirer le premier : c'est un téléversement,
 * pas une modification, et l'écran le dit (« supprimez et re-téléversez »).
 */
export async function enregistrerPhoto(
  id: string,
  formData: FormData,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const eventIdBrut = String(formData.get("eventId") ?? "");
  const eventId = eventIdBrut === "" ? null : eventIdBrut;
  if (eventId !== null && !identifiant.safeParse(eventId).success) {
    return { ok: false, error: "L'événement choisi n'est pas valide. Rechargez la page." };
  }

  // `filename`, `sortOrder` et `isPublished` ne sont PAS dans ce formulaire : les omettre du
  // schéma est ce qui garantit qu'un POST direct ne peut pas les réécrire au passage.
  const analyse = photoInputSchema
    .omit({ filename: true, sortOrder: true, isPublished: true })
    .safeParse({
      alt: formData.get("alt"),
      caption: formData.get("caption"),
      eventId,
    });

  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    const [ligne] = await db
      .update(photo)
      .set(analyse.data)
      .where(eq(photo.id, id))
      .returning({ id: photo.id });

    if (!ligne) {
      return { ok: false, error: "Cette photo n'existe plus : elle a été supprimée entre-temps." };
    }
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[enregistrerPhoto] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Publie ou dépublie une photo.
 *
 * ⚠️ LA DÉPUBLICATION EST LE MÉCANISME DE RETRAIT, et elle met **jusqu'à une heure** à
 * atteindre un visiteur qui a déjà chargé l'image : la route de service pose
 * `max-age=3600, must-revalidate` (c'est précisément pourquoi la 4.3 a refusé `immutable`).
 * L'écran le dit ; le taire ferait croire à un retrait instantané.
 */
export async function definirPublicationPhoto(
  id: string,
  publier: boolean,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .update(photo)
      .set({ isPublished: publier })
      .where(eq(photo.id, id))
      .returning({ id: photo.id });

    if (!ligne) return { ok: false, error: "Cette photo n'existe plus." };
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[definirPublicationPhoto] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Renumérote la galerie : la position dans `ids` DEVIENT le `sort_order`.
 *
 * 🔴 ON RÉÉCRIT TOUT L'ORDRE, ON NE PERMUTE PAS DEUX LIGNES. Une permutation laisse
 * intactes les égalités existantes — or le cas nominal d'aujourd'hui est justement « tout le
 * monde à 0 », où le départage se fait sur un UUID aléatoire. Renuméroter est le seul geste
 * qui rende l'ordre affiché ÉGAL à l'ordre stocké, donc le seul qui rende « monter d'un
 * cran » prévisible.
 *
 * ⚠️ EN UNE TRANSACTION : un ordre à moitié réécrit serait pire que pas d'ordre du tout.
 * ⚠️ La liste doit être COMPLÈTE — l'écran envoie l'intégralité des photos qu'il affiche.
 * Une liste partielle renumérotrait un sous-ensemble et le ferait passer devant le reste.
 */
export async function reordonnerPhotos(
  ordreAttendu: string[],
  nouvelOrdre: string[],
): Promise<ResultatAction<{ nombre: number }>> {
  await requireAdmin();

  if (nouvelOrdre.length === 0) return { ok: true, data: { nombre: 0 } };

  if (!nouvelOrdre.every((id) => identifiant.safeParse(id).success)) {
    return { ok: false, error: "La liste des photos n'est pas valide. Rechargez la page." };
  }
  // Un doublon ferait qu'une ligne prendrait deux rangs et qu'une autre n'en prendrait
  // aucun : la liste ne serait plus une permutation.
  if (new Set(nouvelOrdre).size !== nouvelOrdre.length) {
    return { ok: false, error: "La liste des photos contient un doublon. Rechargez la page." };
  }
  // `nouvelOrdre` doit être une PERMUTATION d'`ordreAttendu`, pas une liste quelconque :
  // sinon un POST direct pourrait renuméroter des lignes qui n'étaient pas à l'écran.
  if (
    ordreAttendu.length !== nouvelOrdre.length ||
    [...ordreAttendu].sort().join() !== [...nouvelOrdre].sort().join()
  ) {
    return { ok: false, error: "La liste des photos n'est pas valide. Rechargez la page." };
  }

  try {
    // ══════════════════════════════════════════════════════════════════════════════════
    // 🔴 CONCURRENCE OPTIMISTE — DÉFAUT RÉEL TROUVÉ EN REVUE, ET IL ÉTAIT SILENCIEUX
    // ══════════════════════════════════════════════════════════════════════════════════
    //
    // La première version ne vérifiait que l'EXISTENCE des lignes. Or chaque ligne de l'écran
    // porte son propre `useTransition` et recalcule l'ordre à partir du MÊME tableau figé au
    // rendu serveur. Deux clics « monter » sur deux lignes différentes, avant que
    // `router.refresh()` n'ait rafraîchi les props, partaient donc tous deux de l'état
    // d'AVANT le premier clic : **le second réécrivait tout et annulait le premier**, avec
    // deux `ok: true` et aucun message. Le bénévole croyait ses deux gestes appliqués.
    //
    // ⇒ L'écran envoie l'ordre qu'il CROYAIT (`ordreAttendu`) en plus de celui qu'il veut.
    // Si la base ne dit plus la même chose, on refuse et on demande un rechargement — c'est
    // la seule réponse honnête : appliquer écraserait un changement qu'on n'a pas vu.
    //
    // ⚠️ La comparaison porte sur le PRÉFIXE de la même longueur, et non sur toute la table :
    // une photo AJOUTÉE entre-temps reçoit `max + 1`, donc se range APRÈS le préfixe et ne
    // fait pas échouer un réordonnancement légitime. Comparer la table entière casserait aussi
    // la fonction dès que la galerie dépasserait la borne de lecture de l'écran (200).
    const actuelles = await db
      .select({ id: photo.id })
      .from(photo)
      .orderBy(asc(photo.sortOrder), asc(photo.id))
      .limit(ordreAttendu.length);

    const inchange =
      actuelles.length === ordreAttendu.length &&
      actuelles.every((ligne, rang) => ligne.id === ordreAttendu[rang]);

    if (!inchange) {
      return {
        ok: false,
        error:
          "La galerie a changé depuis l'affichage de cette page (une photo a été ajoutée, " +
          "supprimée ou déplacée ailleurs). Rechargez pour repartir de l'ordre réel — sinon " +
          "ce changement en écraserait un autre.",
      };
    }

    await db.transaction(async (tx) => {
      for (const [rang, id] of nouvelOrdre.entries()) {
        await tx.update(photo).set({ sortOrder: rang }).where(eq(photo.id, id));
      }
    });

    return { ok: true, data: { nombre: nouvelOrdre.length } };
  } catch (erreur) {
    console.error("[reordonnerPhotos] Échec de la renumérotation :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Supprime une photo — la ligne **et** le fichier.
 *
 * 🔴 LIGNE D'ABORD, FICHIER ENSUITE, ET L'ORDRE EST LA DÉCISION. Les deux échecs possibles
 * ne coûtent pas la même chose :
 *   · ligne puis fichier → si la seconde étape échoue, il reste un **octet orphelin** sur le
 *     volume : invisible du public, sans conséquence sur le rendu ;
 *   · fichier puis ligne → une ligne pointerait sur rien, c'est-à-dire un **cadre cassé sur
 *     la page d'accueil**.
 * On préfère perdre l'octet.
 *
 * ⚠️ L'ÉCHEC DE LA SECONDE ÉTAPE SE JOURNALISE ET NE REMONTE PAS. La photo a bien disparu du
 * site : ce que le bénévole demandait est fait. Lui rendre une erreur le ferait recliquer sur
 * une ligne qui n'existe plus.
 */
export async function supprimerPhoto(id: string): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .delete(photo)
      .where(eq(photo.id, id))
      .returning({ filename: photo.filename });

    if (!ligne) return { ok: false, error: "Cette photo a déjà été supprimée." };

    const retire = await supprimerMedia(ligne.filename);
    if (!retire) {
      console.error(
        `[supprimerPhoto] Ligne supprimée, fichier CONSERVÉ sur le volume : ${ligne.filename}. ` +
          "Octet orphelin — sans effet sur le rendu, à nettoyer à la main si besoin.",
      );
    }
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerPhoto] Échec de la suppression :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}
