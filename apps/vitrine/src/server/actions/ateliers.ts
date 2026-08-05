"use server";

import { and, asc, eq } from "drizzle-orm";

import { workshopInputSchema, type WorkshopFamily } from "../../lib/schemas/workshop";
import { requireAdmin } from "../auth/guard";
import { db } from "../db/client";
import { workshop } from "../db/schema";
import {
  erreursParChamp,
  identifiant,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * Server Actions des ateliers du back-office (Story 6.9, FR34, FR22, AR-API1, AR-DB4).
 *
 * Le patron de saisie est celui d'`actions/agenda.ts` (6.3), `actions/galerie.ts` (6.4) puis
 * `actions/partenaires.ts` (6.5), repris **littéralement** : `await requireAdmin()` en PREMIÈRE
 * LIGNE de chaque action, retour discriminé, `identifiant` sur tout `id` reçu, aucun
 * `revalidateTag` (les pages publiques sont `force-dynamic`, il n'y a rien à invalider — fait
 * mesuré au cadrage de l'Epic 6, et `check:docs` a une règle qui le tient).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUI EST PLUS SIMPLE ICI QUE PARTOUT AILLEURS, ET POURQUOI ON N'IMPORTE PAS LE RESTE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * C'est la **première surface de saisie de l'Epic 6 en TEXTE PUR**. L'agenda portait les
 * fuseaux, la galerie et les partenaires portaient des FICHIERS — donc `server/medias`, `sharp`,
 * les octets orphelins, la concurrence sur un fichier, les routes de service. **Rien de tout
 * cela n'existe ici** : un atelier n'a pas de média, et aucune clé étrangère ne le référence.
 *
 * ⚠️ Conséquence à ne pas confondre avec un oubli : il n'y a **ni** `retirerFichierSiDuVolume`,
 * **ni** garde de suppression en deux temps côté serveur, **ni** concurrence optimiste sur une
 * colonne de fichier. Les importer « par symétrie » ajouterait du code qui ne protège rien.
 * La concurrence optimiste, elle, EST présente — mais sur l'**ordre**, où elle a été payée par
 * un défaut réel (revue de la 6.4).
 */

/**
 * Nom lisible du champ derrière chaque contrainte de la table `workshop`.
 *
 * ⚠️ TABLE PROPRE À CE DOMAINE, et c'est le point de l'extraction de `_commun.ts` : le
 * traducteur est partagé, sa table ne l'est pas. Une table commune ferait qu'ajouter une
 * contrainte côté agenda toucherait les ateliers.
 *
 * 🔴 LES TROIS NOMS SONT CEUX DE LA MIGRATION `0010`, VÉRIFIÉS DANS LE `.sql` GÉNÉRÉ. Une
 * contrainte absente de cette table retombe sur un message générique qui **ne nomme aucun
 * champ** — c'est le défaut trouvé en revue de la 6.3, où huit contraintes sur dix y tombaient.
 */
const CHAMP_PAR_CONTRAINTE: Record<string, string> = {
  workshop_title_valide: "l'intitulé",
  workshop_summary_valide: "la description",
  workshop_audience_valide: "le public visé",
};

/**
 * Cas particuliers : contraintes dont le message ne se déduit pas du nom d'un champ.
 * `workshop` n'en a aucune — ses trois `CHECK` portent chacun sur un champ unique.
 */
const CAS_PARTICULIERS: Record<string, string> = {};

/** Traducteur partagé (`_commun.ts`), appliqué à la table de CE domaine. */
function messageErreurBase(erreur: unknown): string {
  return traduireErreurBase(erreur, CHAMP_PAR_CONTRAINTE, CAS_PARTICULIERS);
}

/**
 * Lit les champs d'un formulaire d'atelier et les valide.
 *
 * ⚠️ `sortOrder` et `isPublished` sont OMIS du schéma, et **l'omission est la garde** : c'est
 * elle qui empêche un POST direct de les réécrire au passage. Chacun a sa propre action —
 * ce qui rend par construction impossible la dette **R35** (l'écrasement silencieux d'un
 * `isPublished` basculé depuis la liste pendant qu'un formulaire était ouvert).
 */
function analyserChamps(formData: FormData) {
  return workshopInputSchema.omit({ sortOrder: true, isPublished: true }).safeParse({
    title: formData.get("title"),
    family: formData.get("family"),
    summary: formData.get("summary"),
    audience: formData.get("audience"),
  });
}

/**
 * Crée un atelier, **en brouillon**.
 *
 * ⚠️ Le rang est CALCULÉ dans la famille choisie, jamais laissé au défaut `0` : sinon le
 * départage se fait sur le titre puis l'UUID, et « monter d'un cran » n'aurait aucune prise —
 * même défaut que celui corrigé dans la galerie puis chez les partenaires.
 */
export async function creerAtelier(
  formData: FormData,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  const analyse = analyserChamps(formData);
  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    const rang = await rangSuivant(analyse.data.family);
    const [ligne] = await db
      .insert(workshop)
      // 🔴 `isPublished: false` EXPLICITE : un atelier naît invisible. Le laisser au défaut de
      // colonne marcherait aussi — l'écrire ici rend l'intention lisible à l'endroit où
      // quelqu'un serait tenté d'ajouter un champ au formulaire.
      .values({ ...analyse.data, sortOrder: rang, isPublished: false })
      .returning({ id: workshop.id });
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[creerAtelier] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/** Le rang suivant DANS UNE FAMILLE (l'ordre ne franchit jamais une famille). */
async function rangSuivant(famille: WorkshopFamily): Promise<number> {
  const lignes = await db
    .select({ sortOrder: workshop.sortOrder })
    .from(workshop)
    .where(eq(workshop.family, famille));
  return lignes.reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1;
}

/**
 * Met à jour l'intitulé, la famille, la description et le public visé.
 *
 * ⚠️ NE TOUCHE NI AU RANG, NI À LA PUBLICATION — chacun a son action (voir `analyserChamps`).
 *
 * 🔴 CHANGER DE FAMILLE DÉPLACE L'ENTRÉE DANS UN AUTRE ORDRE. Son `sort_order` n'a plus de sens
 * dans sa nouvelle famille (il peut entrer en collision, ou la propulser en tête). On lui donne
 * donc le **rang suivant de sa nouvelle famille** — c'est le comportement le moins surprenant :
 * elle arrive à la fin, et se remonte à la main. **L'écran le dit** ; le deviner serait pénible.
 */
export async function enregistrerAtelier(
  id: string,
  formData: FormData,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

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
    const actuel = await db.query.workshop.findFirst({
      columns: { family: true },
      where: (table, { eq: egal }) => egal(table.id, id),
    });
    if (!actuel) {
      return { ok: false, error: "Cet atelier n'existe plus : il a été supprimé entre-temps." };
    }

    const changeDeFamille = actuel.family !== analyse.data.family;
    const valeurs = changeDeFamille
      ? { ...analyse.data, sortOrder: await rangSuivant(analyse.data.family) }
      : analyse.data;

    const [ligne] = await db
      .update(workshop)
      .set(valeurs)
      .where(eq(workshop.id, id))
      .returning({ id: workshop.id });

    if (!ligne) {
      return { ok: false, error: "Cet atelier n'existe plus : il a été supprimé entre-temps." };
    }
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[enregistrerAtelier] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Publie ou dépublie un atelier — **le geste NOMINAL de cet écran**.
 *
 * ⚠️ Dépublier ne supprime rien : *une offre saisonnière se republie, elle ne se ressaisit pas*
 * (AC d'`epics.md`, patron `isDeleted` observé sur `07 site MSL`). C'est pour cela que la
 * suppression dure porte un libellé et une confirmation entièrement distincts côté écran.
 */
export async function definirPublicationAtelier(
  id: string,
  publier: boolean,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .update(workshop)
      .set({ isPublished: publier })
      .where(eq(workshop.id, id))
      .returning({ id: workshop.id });

    if (!ligne) return { ok: false, error: "Cet atelier n'existe plus." };
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[definirPublicationAtelier] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Supprime un atelier — définitivement.
 *
 * ⚠️ **AUCUN EFFET DE BORD, ET C'EST CE QUI REND CE `DELETE` SÛR** : aucune clé étrangère ne
 * référence `workshop`, et aucun fichier ne lui est rattaché. Contrairement à un événement (dont
 * la suppression a demandé un raisonnement sur les photos qui lui survivent) et à un partenaire
 * (dont le logo part avec lui), il n'y a rien d'autre à décider ici.
 *
 * La confirmation en DEUX TEMPS vit côté écran (`BoutonConfirmation`) : c'est là qu'elle protège
 * quelqu'un. Une seconde garde côté serveur n'empêcherait rien qu'un POST direct ne contourne
 * de toute façon — et `requireAdmin()` est la garde qui, elle, compte.
 */
export async function supprimerAtelier(id: string): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .delete(workshop)
      .where(eq(workshop.id, id))
      .returning({ id: workshop.id });

    if (!ligne) return { ok: false, error: "Cet atelier a déjà été supprimé." };
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerAtelier] Échec de la suppression :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Renumérote **UNE FAMILLE** : la position dans `nouvelOrdre` devient le `sort_order`.
 *
 * 🔴 UNE FAMILLE, PAS TOUTE LA TABLE. Le tri du catalogue est `family, sort_order, title, id` :
 * `family` tranche **AVANT** `sort_order`, donc « monter un atelier au-dessus d'une autre
 * famille » n'a **aucun sens et aucun effet observable**. Un écran qui proposerait un ordre
 * global à plat mentirait sur ce qu'il fait. Transposition exacte du point ③ de
 * `actions/partenaires.ts`.
 *
 * 🔴 ON RÉÉCRIT TOUT L'ORDRE DE LA FAMILLE, ON NE PERMUTE PAS DEUX LIGNES. Une permutation
 * laisse intactes les égalités existantes — or le cas nominal après un back-office qui laisse
 * le défaut `0` est « tout le monde à 0 », où le départage se fait sur le titre puis l'UUID.
 *
 * ⚠️ EN UNE TRANSACTION : un ordre à moitié réécrit serait pire que pas d'ordre du tout.
 *
 * 🔴 CONCURRENCE OPTIMISTE — REPRISE D'UN DÉFAUT RÉEL TROUVÉ EN REVUE DE LA 6.4. Chaque ligne
 * de l'écran porte son propre `useTransition` et recalcule l'ordre à partir du MÊME tableau figé
 * au rendu serveur : sans cette comparaison, deux clics rapides partent tous deux de l'état
 * d'AVANT le premier, et le second annule silencieusement le premier — **deux `ok: true`, un
 * seul geste appliqué**.
 * ⚠️ **La comparaison porte sur la FAMILLE, pas sur un préfixe de la table** : comparer un
 * préfixe global ferait échouer le réordonnancement d'une famille parce qu'une autre a bougé.
 */
export async function reordonnerAteliers(
  famille: WorkshopFamily,
  ordreAttendu: string[],
  nouvelOrdre: string[],
): Promise<ResultatAction<{ nombre: number }>> {
  await requireAdmin();

  // 🔴 LA FAMILLE EST VALIDÉE COMME LES IDENTIFIANTS — TROUVÉ EN REVUE.
  // Elle est TYPÉE `WorkshopFamily`, mais un type ne survit pas à la compilation : une Server
  // Action reste atteignable par **POST direct**, exactement comme le rappelle `_commun.ts`
  // à propos d'`identifiant`. Sans cette garde, une chaîne hors énumération atteignait
  // `eq(workshop.family, famille)` et faisait lever Postgres (`22P02`) — sans fuite ni
  // corruption, mais traduit en « Cet identifiant n'est pas valide », un message qui parle
  // d'un identifiant là où c'est la famille qui est en cause.
  // ⚠️ On consomme `workshopInputSchema.shape.family`, jamais une seconde liste : c'est le
  // MÊME `z.enum(WORKSHOP_FAMILIES)` que celui du formulaire. Une copie divergerait.
  if (!workshopInputSchema.shape.family.safeParse(famille).success) {
    return { ok: false, error: "Cette famille d'ateliers n'existe pas. Rechargez la page." };
  }

  if (nouvelOrdre.length === 0) return { ok: true, data: { nombre: 0 } };

  if (!nouvelOrdre.every((id) => identifiant.safeParse(id).success)) {
    return { ok: false, error: "La liste des ateliers n'est pas valide. Rechargez la page." };
  }
  // Un doublon ferait qu'une ligne prendrait deux rangs et qu'une autre n'en prendrait aucun :
  // la liste ne serait plus une permutation.
  if (new Set(nouvelOrdre).size !== nouvelOrdre.length) {
    return { ok: false, error: "La liste des ateliers contient un doublon. Rechargez la page." };
  }
  // `nouvelOrdre` doit être une PERMUTATION d'`ordreAttendu`, pas une liste quelconque : sinon
  // un POST direct pourrait renuméroter des lignes qui n'étaient pas à l'écran.
  if (
    ordreAttendu.length !== nouvelOrdre.length ||
    [...ordreAttendu].sort().join() !== [...nouvelOrdre].sort().join()
  ) {
    return { ok: false, error: "La liste des ateliers n'est pas valide. Rechargez la page." };
  }

  try {
    const actuelles = await db
      .select({ id: workshop.id })
      .from(workshop)
      .where(eq(workshop.family, famille))
      .orderBy(asc(workshop.sortOrder), asc(workshop.title), asc(workshop.id));

    const inchange =
      actuelles.length === ordreAttendu.length &&
      actuelles.every((ligne, rang) => ligne.id === ordreAttendu[rang]);

    if (!inchange) {
      return {
        ok: false,
        error:
          "Cette famille a changé depuis l'affichage de la page (un atelier a été ajouté, " +
          "supprimé, ou déplacé dans une autre famille). Rechargez pour repartir de l'ordre " +
          "réel — sinon ce changement en écraserait un autre.",
      };
    }

    await db.transaction(async (tx) => {
      for (const [rang, id] of nouvelOrdre.entries()) {
        // ⚠️ Le `and(…, eq(family))` n'est pas décoratif : il empêche qu'un identifiant d'une
        // AUTRE famille, glissé dans la liste par un POST direct, se voie attribuer un rang
        // ici. La permutation ci-dessus le rendrait déjà très difficile ; celle-ci le rend
        // impossible.
        await tx
          .update(workshop)
          .set({ sortOrder: rang })
          .where(and(eq(workshop.id, id), eq(workshop.family, famille)));
      }
    });

    return { ok: true, data: { nombre: nouvelOrdre.length } };
  } catch (erreur) {
    console.error("[reordonnerAteliers] Échec de la renumérotation :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}
