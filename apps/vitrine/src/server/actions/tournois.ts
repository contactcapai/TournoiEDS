"use server";

import { eq } from "drizzle-orm";

import { parisWallClockFromInput, diagnostiquerHeureMurale } from "../../lib/date-paris";
import { tournamentInputSchema } from "../../lib/schemas/tournament";
import { requireAdmin } from "../auth/guard";
import { db } from "../db/client";
import { slugDejaPris } from "../db/queries/tournaments";
import { tournament } from "../db/schema";
import {
  erreursParChamp,
  identifiant,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * Server Actions des tournois du back-office (Story 9.1, A21/A22/A23, AR-API1).
 *
 * Le patron de saisie est celui d'`actions/agenda.ts` (6.3), `actions/ateliers.ts` (6.9) puis
 * `actions/reglages.ts` (6.13), repris **littéralement** : `await requireAdmin()` en PREMIÈRE
 * LIGNE de chaque action, retour discriminé, `identifiant` sur tout `id` reçu, aucun
 * `revalidateTag` (les pages publiques sont `force-dynamic`, il n'y a rien à invalider —
 * `check:docs` a une règle qui le tient).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 `requireAdmin()` EST PAYÉ **ICI**, PAS SEULEMENT DANS LE PROXY — FAIT MESURÉ EN 6.1
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Documentation Next 16 (`proxy.js`, § Execution order), citée dans `server/auth/guard.ts` :
 * *« Server Functions are not separate routes in this chain […] a Proxy matcher that excludes
 * a path will also skip Proxy coverage […] Always verify authentication and authorization
 * inside each Server Function rather than relying on Proxy alone. »*
 * ⇒ Une garde oubliée ici serait **silencieuse** : elle ne casse rien, elle laisse passer.
 *
 * ⚠️ **CETTE SECTION EST OUVERTE AUX ADMINISTRATEURS ACTUELS**, et l'écart est écrit plutôt que
 * subi (A22) : `requireAdmin()` ne connaît **qu'un seul rôle**. La restriction au rôle **admin
 * tournoi** arrive avec la **Story 8.1** (A2, dette **R39** rouverte le 2026-08-13 : trois
 * comptes existent sur staging). Jusque-là, quiconque peut modifier le site peut modifier les
 * tournois — c'est un fait connu, pas une découverte à faire plus tard.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUI EST PLUS SIMPLE ICI QUE PARTOUT AILLEURS, ET POURQUOI ON N'IMPORTE PAS LE RESTE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Un tournoi n'a **aucun fichier** (le visuel viendra de la galerie, A2, et pas dans cette
 * story) et **aucun ordre manuel** — il est ordonné par sa DATE. Il n'y a donc ici ni
 * `server/medias`, ni `sharp`, ni octets orphelins, ni renumérotation, ni **concurrence
 * optimiste sur un rang**. Les importer « par symétrie » avec les ateliers ou les partenaires
 * ajouterait du code qui ne protège rien.
 */

/**
 * Nom lisible du champ derrière chaque contrainte de la table `tournament`.
 *
 * 🔴 LES QUATORZE NOMS SONT CEUX DE LA MIGRATION `0014`, VÉRIFIÉS DANS LE `.sql` GÉNÉRÉ. Une
 * contrainte absente de cette table retombe sur un message générique qui **ne nomme aucun
 * champ** — c'est le défaut trouvé en revue de la 6.3, où huit contraintes sur dix y tombaient.
 * ⚠️ TABLE PROPRE À CE DOMAINE : le traducteur d'`_commun.ts` est partagé, sa table ne l'est
 * pas. Une table commune ferait qu'ajouter une contrainte côté agenda toucherait les tournois.
 */
const CHAMP_PAR_CONTRAINTE: Record<string, string> = {
  tournament_name_valide: "le nom du tournoi",
  tournament_game_valide: "le jeu",
  tournament_slug_valide: "l'identifiant de l'adresse",
  tournament_venue_name_valide: "la salle ou l'espace",
  tournament_format_text_valide: "le déroulé annoncé",
  tournament_prizes_valide: "les lots",
  tournament_match_duration_valide: "la durée d'un match",
  tournament_capacity_valide: "le nombre de places",
  tournament_registration_url_valide: "l'adresse d'inscription",
  tournament_podium_first_valide: "la première place du podium",
  tournament_podium_second_valide: "la deuxième place du podium",
  tournament_podium_third_valide: "la troisième place du podium",
};

/**
 * Cas dont le message ne se déduit PAS du nom d'un champ.
 *
 * Les trois portent des règles qui mettent **deux colonnes en relation** : nommer un seul
 * champ serait faux la moitié du temps (patron `event_has_venue`).
 */
const CAS_PARTICULIERS: Record<string, string> = {
  tournament_mately_a_son_url:
    "Un tournoi dont les inscriptions passent par MATELY doit porter une adresse " +
    "d'inscription : sans elle, la fiche annoncerait des inscriptions sans aucun moyen de " +
    "s'inscrire.",
  tournament_podium_sans_trou_2:
    "Renseignez la première place du podium avant la deuxième.",
  tournament_podium_sans_trou_3:
    "Renseignez la deuxième place du podium avant la troisième.",
};

/**
 * Traducteur partagé (`_commun.ts`), appliqué à la table de CE domaine.
 *
 * ⚠️ DEUX CODES SONT RÉÉCRITS ICI, ET CHACUN POUR UNE RAISON PROPRE À CETTE TABLE :
 *   · `23505` — `_commun.ts` rend « Cet élément existe déjà », vrai mais inutilisable : la
 *     **seule** contrainte d'unicité de `tournament` est celle de l'identifiant d'adresse, et
 *     c'est la seule chose que le bénévole peut corriger ;
 *   · `23503` — la **seule** clé étrangère est l'événement de rattachement (A4). Le message
 *     générique parle d'« élément » parce qu'il sert plusieurs domaines ; le nommer évite de
 *     faire chercher. ⚠️ Symétrique du correctif posé dans `actions/agenda.ts` par cette même
 *     story, dans l'autre sens (là-bas : une suppression d'événement **bloquée** par un
 *     tournoi ; ici : un rattachement à un événement **disparu**).
 */
function messageErreurBase(erreur: unknown): string {
  const details = erreur as { code?: string; constraint_name?: string; constraint?: string };
  const contrainte = details.constraint_name ?? details.constraint ?? "";

  if (details.code === "23505" && contrainte.includes("slug")) {
    return (
      "Cette adresse est déjà utilisée par un autre tournoi. Changez l'identifiant de " +
      "l'adresse — deux tournois ne peuvent pas partager la même page."
    );
  }
  if (details.code === "23503") {
    return (
      "L'événement d'agenda choisi n'existe plus. Rechargez la page et choisissez-en un autre."
    );
  }
  return traduireErreurBase(erreur, CHAMP_PAR_CONTRAINTE, CAS_PARTICULIERS);
}

/** Ce que l'écran reçoit après un enregistrement réussi. */
export type TournoiEnregistre = {
  id: string;
  /** Message R23 quand l'heure saisie est inexistante ou ambiguë. `null` sinon. */
  avertissement: string | null;
};

/**
 * Lit un entier facultatif d'un `FormData`.
 *
 * 🔴 LA CHAÎNE VIDE DOIT VALOIR `null` ET **JAMAIS `0`** — et c'est le piège de ce helper.
 * `Number("")` rend **`0`**, une valeur parfaitement plausible qui traverserait Zod (`.min(1)`
 * la refuserait ici, mais pas partout) et surtout qui **change le sens** : « aucune capacité
 * annoncée » deviendrait « zéro place ». On teste donc la chaîne AVANT de convertir.
 * ⚠️ `Number("12abc")` rend `NaN`, que `z.number()` refuse avec un message lisible : on ne le
 * transforme pas en `null`, sinon une faute de frappe **effacerait** silencieusement la valeur
 * déjà saisie au lieu de la signaler.
 */
function entierOptionnel(valeur: FormDataEntryValue | null): number | null | typeof Number.NaN {
  const texte = String(valeur ?? "").trim();
  if (texte.length === 0) return null;
  return Number(texte);
}

/**
 * Crée ou met à jour un tournoi.
 *
 * 🔴 LA DATE EST CONVERTIE **AVANT** ZOD, ET C'EST L'ORDRE QUI COMPTE. Le champ
 * `<input type="datetime-local">` rend `"2026-11-21T14:00"` — **sans fuseau, par
 * spécification** —, c'est-à-dire exactement la forme que `instantAvecFuseau` REFUSE. La
 * conversion passe par `parisWallClockFromInput`, seul pont autorisé, et Zod reçoit un `Date`
 * déjà juste. Inverser les deux ferait échouer toute saisie avec le message « Date sans fuseau
 * horaire », que le bénévole ne pourrait pas corriger. Piège `date-tz.md`, mesuré en 6.3, et
 * il est **bidirectionnel et invisible en local**.
 *
 * ⚠️ `idExistant` est passé en ARGUMENT par l'appelant — **jamais lu depuis `formData`**, où
 * il serait modifiable par le client.
 *
 * ⚠️ `isPublished` est **ABSENT** de ce qui est écrit, et **l'omission EST la garde** : il a sa
 * propre action, donc ce formulaire ne peut pas écraser une publication basculée depuis la
 * liste pendant qu'il était ouvert. C'est la dette **R35** rendue sans objet par le découpage
 * plutôt que par un jeton de version (patron 6.9).
 */
export async function enregistrerTournoi(
  idExistant: string | null,
  formData: FormData,
): Promise<ResultatAction<TournoiEnregistre>> {
  await requireAdmin();

  if (idExistant !== null && !identifiant.safeParse(idExistant).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const saisieDate = String(formData.get("startsAt") ?? "");
  const instant = parisWallClockFromInput(saisieDate);

  if (instant === null) {
    return {
      ok: false,
      error: "Cette date n'existe pas.",
      fieldErrors: {
        startsAt: "Vérifiez le jour, le mois et l'heure : cette date n'existe pas.",
      },
    };
  }

  const analyse = tournamentInputSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    name: formData.get("name"),
    game: formData.get("game"),
    slug: formData.get("slug"),
    startsAt: instant,
    venueName: formData.get("venueName"),
    formatText: formData.get("formatText"),
    prizes: formData.get("prizes"),
    matchDurationMinutes: entierOptionnel(formData.get("matchDurationMinutes")),
    capacity: entierOptionnel(formData.get("capacity")),
    registrationMode: formData.get("registrationMode"),
    registrationUrl: formData.get("registrationUrl"),
    registrationState: formData.get("registrationState") ?? undefined,
    podiumFirst: formData.get("podiumFirst"),
    podiumSecond: formData.get("podiumSecond"),
    podiumThird: formData.get("podiumThird"),
  });

  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  const valeurs = analyse.data;

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 L'IDENTIFIANT D'ADRESSE SE **FIGE À LA PUBLICATION** — A3, ET CE N'EST PAS UN `CHECK`
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * Une URL partagée sur Discord, imprimée sur un flyer ou lue dans une description de stream
   * doit rester valide. Tant que le tournoi est un **brouillon**, personne n'a pu la diffuser :
   * elle se modifie librement. Dès qu'il est **publié**, elle est gelée.
   *
   * ⚠️ CETTE RÈGLE N'EST **PAS** EXPRIMABLE PAR UN `CHECK` : elle compare la valeur **nouvelle**
   * à la valeur **précédente**, c'est-à-dire deux versions de la même ligne, ce qu'une
   * contrainte ne voit pas. Elle se tient donc **à la frontière d'écriture**, exactement comme
   * la note d'architecture (§7 ②) le prescrit pour l'invariant « 1..N membres ». Un `UPDATE`
   * direct la contourne, et c'est assumé : le risque est un lien cassé, pas une corruption.
   * 🔴 `gate:tournois` la prouve **DANS LES DEUX SENS** — un brouillon dont l'identifiant
   * change, un publié dont il ne change pas. Un seul des deux sens ne prouverait rien.
   */
  if (idExistant !== null) {
    const actuel = await db.query.tournament.findFirst({
      columns: { slug: true, isPublished: true },
      where: (table, { eq: egal }) => egal(table.id, idExistant),
    });
    if (!actuel) {
      return { ok: false, error: "Ce tournoi n'existe plus : il a été supprimé entre-temps." };
    }
    if (actuel.isPublished && actuel.slug !== valeurs.slug) {
      return {
        ok: false,
        error: "L'adresse d'un tournoi publié ne peut plus changer.",
        fieldErrors: {
          slug:
            "Ce tournoi est publié : son adresse est figée, parce qu'elle a pu être partagée " +
            "sur Discord, imprimée ou lue en direct. Pour la changer, retirez d'abord le " +
            "tournoi du site — les visiteurs qui suivraient l'ancien lien tomberaient sinon " +
            "sur une page introuvable.",
        },
      };
    }
  }

  // 🔴 CE CONTRÔLE EST LE **MESSAGE**, PAS LE GARDE-FOU — celui-ci est la contrainte
  // `tournament_slug_unique` en base, seule chose qu'un `UPDATE` direct ne contourne pas. Sans
  // cette lecture, un doublon remonterait sous la forme d'un `23505` traduit après que le
  // bénévole a rempli douze champs. ⚠️ Sujette à une course, et c'est sans gravité : la base
  // tranche derrière, et `messageErreurBase` traduit son refus.
  const collision = await slugDejaPris(valeurs.slug, idExistant);
  if (collision) {
    return {
      ok: false,
      error: "Cette adresse est déjà prise.",
      fieldErrors: {
        slug: `Cette adresse est déjà utilisée par le tournoi « ${collision.name} ». Choisissez-en une autre.`,
      },
    };
  }

  const diagnostic = diagnostiquerHeureMurale(saisieDate);
  const avertissement = diagnostic.cas === "ok" ? null : diagnostic.message;

  try {
    if (idExistant === null) {
      const [ligne] = await db
        .insert(tournament)
        // 🔴 `isPublished: false` EXPLICITE : un tournoi naît invisible. Le laisser au défaut
        // de colonne marcherait aussi — l'écrire ici rend l'intention lisible à l'endroit où
        // quelqu'un serait tenté d'ajouter le champ au formulaire.
        .values({ ...valeurs, isPublished: false })
        .returning({ id: tournament.id });
      return { ok: true, data: { id: ligne.id, avertissement } };
    }

    const [ligne] = await db
      .update(tournament)
      .set(valeurs)
      .where(eq(tournament.id, idExistant))
      .returning({ id: tournament.id });

    if (!ligne) {
      return { ok: false, error: "Ce tournoi n'existe plus : il a été supprimé entre-temps." };
    }
    return { ok: true, data: { id: ligne.id, avertissement } };
  } catch (erreur) {
    // Sans cette trace, un échec d'écriture en production (pool épuisé, base injoignable,
    // divergence Zod/CHECK) est totalement invisible — leçon de la Story 5.1.
    console.error("[enregistrerTournoi] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Publie ou dépublie un tournoi — **le geste NOMINAL de cet écran**.
 *
 * Action distincte de l'enregistrement, et volontairement minuscule : publier depuis la LISTE
 * ne doit pas exiger de rouvrir le formulaire, ni risquer de réécrire des champs (dette R35).
 *
 * ⚠️ DÉPUBLIER NE SUPPRIME RIEN, et c'est aussi ce qui **rouvre** l'identifiant d'adresse à la
 * modification (voir `enregistrerTournoi`). Les deux règles se tiennent : on ne change pas
 * l'adresse d'un tournoi en ligne, on le retire d'abord.
 */
export async function definirPublicationTournoi(
  id: string,
  publier: boolean,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .update(tournament)
      .set({ isPublished: publier })
      .where(eq(tournament.id, id))
      .returning({ id: tournament.id });

    if (!ligne) return { ok: false, error: "Ce tournoi n'existe plus." };
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[definirPublicationTournoi] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Supprime un tournoi — définitivement.
 *
 * ⚠️ **AUCUN EFFET DE BORD AUJOURD'HUI, ET CE NE SERA PAS VRAI DEMAIN.** Aucune clé étrangère
 * ne référence `tournament` (le périmètre A5 exclut phases, inscriptions et engagés) et aucun
 * fichier ne lui est rattaché : ce `DELETE` est donc sûr, exactement comme celui d'un atelier.
 * 🔴 Dès la **Story 10.1**, `phase` et `registration` le référenceront — et il faudra alors
 * décider explicitement entre `CASCADE` (détruire le déroulé avec le tournoi) et `RESTRICT`
 * (refuser tant qu'il reste des inscrits). **Ne pas laisser ce choix au défaut de Drizzle** :
 * c'est ce qui a rendu la suppression d'un `event` délicate, et le raisonnement est écrit sur
 * `tournament.eventId`.
 *
 * La confirmation en DEUX TEMPS vit côté écran (`BoutonConfirmation`) : c'est là qu'elle
 * protège quelqu'un. Une seconde garde côté serveur n'empêcherait rien qu'un POST direct ne
 * contourne de toute façon — et `requireAdmin()` est la garde qui, elle, compte.
 */
export async function supprimerTournoi(id: string): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .delete(tournament)
      .where(eq(tournament.id, id))
      .returning({ id: tournament.id });

    if (!ligne) return { ok: false, error: "Ce tournoi a déjà été supprimé." };
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerTournoi] Échec de la suppression :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}
