import "server-only";

import { and, asc, eq, isNotNull, or } from "drizzle-orm";

import {
  agregerParEngage,
  classer,
  type PlaceLue,
} from "../../../lib/tournoi/classement";
import {
  estDeLaFinale,
  issueDeLaFinale,
  manchesDeFinale,
  seuilDeLaFinale,
} from "../../../lib/tournoi/finale";
import type { SourceResolue } from "../../../lib/tournoi/generation";
import { rangsParParcours, rangsParVictoires } from "../../../lib/tournoi/parcours";
import { calculerPropagation, issueDeRencontre } from "../../../lib/tournoi/progression";
import { joueCeJourLa, pointagesDuJour } from "../../../lib/tournoi/presence";
import { estParTables, type PhaseKind } from "../../../lib/tournoi/structure";
import { db } from "../client";
import {
  tournament,
  tournamentEntry,
  tournamentEntryAttendance,
  tournamentMatch,
  tournamentMatchSlot,
  tournamentPhase,
} from "../schema";

/**
 * Ce que l'écran du jour J lit : les rencontres d'une phase, et le classement du tournoi
 * (Story 10.8).
 *
 * 🔴 RIEN N'EST STOCKÉ EN DOUBLE. Les points, les statistiques et le rang **ne sont pas des
 * colonnes** : ils se recalculent à chaque lecture depuis `classement.ts`. Une colonne
 * `points` deviendrait fausse au premier résultat corrigé qu'on aurait oublié de lui signaler —
 * c'est la leçon du sous-total dérivé de la 6.13, et ici l'enjeu est un classement affiché
 * devant des joueurs.
 */

/** La phase à jouer, avec ce que l'écran doit dire du tournoi qui la porte. */
export async function getPhasePourJeu(phaseId: string) {
  const [ligne] = await db
    .select({
      id: tournamentPhase.id,
      tournoiId: tournamentPhase.tournamentId,
      tournoiNom: tournament.name,
      position: tournamentPhase.position,
      name: tournamentPhase.name,
      kind: tournamentPhase.kind,
      state: tournamentPhase.state,
      settings: tournamentPhase.settings,
      /** Le jour de cette phase — il décide de QUEL pointage fait foi (2026-08-24). */
      playedOn: tournamentPhase.playedOn,
    })
    .from(tournamentPhase)
    .innerJoin(tournament, eq(tournament.id, tournamentPhase.tournamentId))
    .where(eq(tournamentPhase.id, phaseId))
    .limit(1);

  return ligne;
}

/**
 * Les rencontres d'une phase, places comprises, avec le nom de chaque occupant.
 *
 * ⚠️ L'ordre est `(round, position)` et non `position` seule : `position` est unique dans la
 * phase mais ne dit rien du déroulé — en double élimination, la position 9 peut être un tour 1
 * du tableau des perdants alors que la position 7 est un tour 3 des vainqueurs.
 */
export async function getRencontresDePhase(phaseId: string) {
  const lignes = await db
    .select({
      matchId: tournamentMatch.id,
      position: tournamentMatch.position,
      round: tournamentMatch.round,
      bracket: tournamentMatch.bracket,
      state: tournamentMatch.state,
      slotId: tournamentMatchSlot.id,
      slotPosition: tournamentMatchSlot.position,
      entryId: tournamentMatchSlot.entryId,
      score: tournamentMatchSlot.score,
      rank: tournamentMatchSlot.rank,
      source: tournamentMatchSlot.source,
      nom: tournamentEntry.displayName,
      etatEngage: tournamentEntry.state,
      phaseKind: tournamentPhase.kind,
      phasePosition: tournamentPhase.position,
    })
    .from(tournamentMatch)
    .leftJoin(tournamentMatchSlot, eq(tournamentMatchSlot.matchId, tournamentMatch.id))
    .leftJoin(tournamentEntry, eq(tournamentEntry.id, tournamentMatchSlot.entryId))
    .where(eq(tournamentMatch.phaseId, phaseId))
    .orderBy(
      asc(tournamentMatch.bracket),
      asc(tournamentMatch.round),
      asc(tournamentMatch.position),
      asc(tournamentMatchSlot.position),
    );

  const parRencontre = new Map<
    string,
    {
      matchId: string;
      position: number;
      round: number | null;
      bracket: (typeof lignes)[number]["bracket"];
      state: (typeof lignes)[number]["state"];
      places: {
        slotId: string;
        position: number;
        entryId: string | null;
        nom: string | null;
        score: number | null;
        rank: number | null;
        source: SourceResolue | null;
      }[];
    }
  >();

  for (const ligne of lignes) {
    let rencontre = parRencontre.get(ligne.matchId);
    if (!rencontre) {
      rencontre = {
        matchId: ligne.matchId,
        position: ligne.position,
        round: ligne.round,
        bracket: ligne.bracket,
        state: ligne.state,
        places: [],
      };
      parRencontre.set(ligne.matchId, rencontre);
    }
    // Le `leftJoin` rend une ligne même sans place : une rencontre sans place est un défaut de
    // génération, mais l'écran doit pouvoir l'afficher plutôt que de planter dessus.
    // ⚠️ On teste `slotPosition` **en plus** de `slotId`, et ce n'est pas de la redondance : le
    // `leftJoin` rend les DEUX à `null` ensemble, mais le typage ne le sait pas — et un `as
    // number` masquerait un jour une place réellement sans rang.
    if (ligne.slotId !== null && ligne.slotPosition !== null) {
      rencontre.places.push({
        slotId: ligne.slotId,
        position: ligne.slotPosition,
        entryId: ligne.entryId,
        nom: ligne.nom,
        score: ligne.score,
        rank: ligne.rank,
        source: (ligne.source as SourceResolue | null) ?? null,
      });
    }
  }

  /**
   * 🔴 L'ISSUE VIENT DE `calculerPropagation`, PAS D'UN APPEL DIRECT À `issueDeRencontre`.
   *
   * Et ce n'est pas une commodité : savoir si une place vide est une **exemption** ou une place
   * qui **attend** est TRANSITIF — il faut avoir dépouillé l'amont. `calculerPropagation` est le
   * seul endroit qui le dérive. Appeler `issueDeRencontre` place par place ici afficherait
   * « exemption » là où la propagation dit « attend » : l'écran et la base ne raconteraient pas
   * la même histoire, et c'est l'écran qu'on croirait.
   *
   * ⚠️ On n'écrit RIEN ici — on ne lit que les `issues`. Les déplacements sont appliqués par
   * l'action, dans une transaction.
   */
  const rencontres = [...parRencontre.values()];
  const { issues } = calculerPropagation(
    rencontres.map((rencontre) => ({
      matchId: rencontre.matchId,
      position: rencontre.position,
      places: rencontre.places.map((place) => ({
        slotId: place.slotId,
        position: place.position,
        entryId: place.entryId,
        score: place.score,
        rank: place.rank,
        source: place.source,
      })),
    })),
  );

  return rencontres.map((rencontre) => ({
    ...rencontre,
    /** Recalculée à chaque lecture, jamais stockée — une seule définition du dépouillement. */
    issue: issues.get(rencontre.matchId) ?? issueDeRencontre(rencontre.places),
  }));
}

export type RencontreJouable = Awaited<ReturnType<typeof getRencontresDePhase>>[number];

/**
 * Le rang de chacun DANS une phase, déduit de sa structure (correctif du 2026-08-15).
 *
 * 🔴 IL EXISTE PARCE QUE LE CLASSEMENT AUX POINTS NE VOIT QUE LES LOBBIES. Mesuré sur le tournoi
 * réel de Brice : 14 places au **score**, aucun rang, donc un classement vide sur une double
 * élimination entièrement jouée. Le rang se **déduit** ici, il ne se saisit pas.
 *
 * ⚠️ Rend `null` pour tout format PAR TABLES : là, le rang **est** le classement aux points, et
 * en fabriquer un second à partir des places serait une deuxième définition du même fait.
 */
export function rangsDeLaPhase(kind: PhaseKind, rencontres: readonly RencontreJouable[]) {
  if (estParTables(kind)) return null;

  const nomParEngage = new Map<string, string>();
  for (const rencontre of rencontres) {
    for (const place of rencontre.places) {
      if (place.entryId !== null && place.nom !== null) nomParEngage.set(place.entryId, place.nom);
    }
  }

  const lignes =
    kind === "poule"
      ? rangsParVictoires(rencontres, nomParEngage)
      : rangsParParcours(rencontres, nomParEngage);

  return {
    lignes: lignes.map((ligne) => ({ ...ligne, nom: nomParEngage.get(ligne.id) ?? "—" })),
    nomParEngage,
    /** Vrai quand la phase est jouée jusqu'au bout : un seul engagé au sommet, sans ex æquo. */
    termine:
      rencontres.length > 0 &&
      rencontres.every((r) => r.issue.complete) &&
      lignes.filter((l) => l.rang === 1).length === 1,
  };
}

/**
 * 🔴 UNE PHASE PORTE-T-ELLE UN RÉSULTAT, QUEL QU'IL SOIT ? Le classement aux points ne compte que
 * les **rangs** ; cette question-ci compte aussi les **scores**. Sans elle, l'écran affichait
 * « Aucun résultat saisi » sur un tournoi entièrement joué au score — la phrase fausse qui fait
 * croire à une panne.
 */
export const aDesResultatsSaisis = (rencontres: readonly RencontreJouable[]) =>
  rencontres.some((r) => r.places.some((p) => p.rank !== null || p.score !== null));

/**
 * Les places de tables d'un tournoi, dans l'ordre du déroulé — matière première du classement.
 *
 * ⚠️ **L'ORDRE EST LE CONTRAT** de `agregerParEngage` : elle en dérive `ordre`, qui départage
 * le 4ᵉ critère de `classer()`. On trie par (position de phase, position de rencontre) et
 * **jamais par une horloge** — deux rencontres créées dans la même transaction portent le même
 * `createdAt`.
 *
 * ⚠️ L'`innerJoin` sur `tournamentEntry` écarte les places VIDES : une place que personne
 * n'occupe ne doit pas compter dans la taille de la table (un lobby de 8 où 6 personnes se
 * sont assises est un lobby de 6).
 *
 * @param exigerPublie 🔴 LA GARDE DE LA LECTURE PUBLIQUE, ET ELLE EST **DANS LA REQUÊTE**.
 * Une lecture publique qui déléguerait sa garde à son appelant finirait par être appelée
 * d'ailleurs — et rendrait le classement d'un tournoi en brouillon à qui devinerait son `id`.
 * Aucune porte visuelle ne le verrait : une page qui affiche une section de plus n'a pas l'air
 * cassée. Même raisonnement, mot pour mot, que `getDeroulePublic` (14.1).
 */
async function lirePlacesClassables(
  tournoiId: string,
  exigerPublie: boolean,
): Promise<PlaceLue[]> {
  const lignes = await db
    .select({
      matchId: tournamentMatch.id,
      entryId: tournamentMatchSlot.entryId,
      rank: tournamentMatchSlot.rank,
      nom: tournamentEntry.displayName,
      etatEngage: tournamentEntry.state,
      phaseKind: tournamentPhase.kind,
      phasePosition: tournamentPhase.position,
    })
    .from(tournamentMatchSlot)
    .innerJoin(tournamentMatch, eq(tournamentMatch.id, tournamentMatchSlot.matchId))
    .innerJoin(tournamentPhase, eq(tournamentPhase.id, tournamentMatch.phaseId))
    .innerJoin(tournamentEntry, eq(tournamentEntry.id, tournamentMatchSlot.entryId))
    .innerJoin(tournament, eq(tournament.id, tournamentPhase.tournamentId))
    .where(
      exigerPublie
        ? and(eq(tournamentPhase.tournamentId, tournoiId), eq(tournament.isPublished, true))
        : eq(tournamentPhase.tournamentId, tournoiId),
    )
    .orderBy(asc(tournamentPhase.position), asc(tournamentMatch.position));

  return lignes.map((ligne) => ({
    matchId: ligne.matchId,
    entryId: ligne.entryId as string,
    nom: ligne.nom,
    abandonne: ligne.etatEngage === "abandonne",
    rank: ligne.rank,
    phaseKind: ligne.phaseKind,
    phasePosition: ligne.phasePosition,
  }));
}

/**
 * Le classement du tournoi, recalculé depuis **toutes** les manches classées.
 *
 * 🔴 LA TAILLE DE CHAQUE TABLE EST CELLE DE **CETTE** TABLE, et les points la suivent — c'est
 * ce qui les rend justes quand les lobbies font 6, 6 et 5. Le calcul lui-même vit dans
 * `lib/tournoi/classement.ts` (`agregerParEngage`) depuis la 14.2 : la lecture publique pose sa
 * propre garde et ne peut donc pas appeler celle-ci, et deux copies du calcul trancheraient un
 * jour à l'envers l'une de l'autre.
 *
 * ⚠️ **ELLE REND AUSSI LES ENGAGÉS QUI N'ONT ENCORE RIEN JOUÉ**, à 0 point : une place générée
 * mais pas dépouillée crée quand même sa ligne. C'est voulu ici — le back-office compose la
 * manche suivante depuis ce classement et doit voir tout le plateau. ⚠️ C'est aussi pourquoi la
 * surface publique ne peut pas rendre cette liste telle quelle : voir `classementPubliable`.
 */
/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 UN TOURNOI A DEUX ESPACES DE POINTS DÈS QU'IL PORTE UNE FINALE (Story 10.14)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Les qualifications d'un côté, la finale de l'autre — **et on repart de zéro en finale**.
 * Ce n'est pas un choix d'affichage : c'est ce que fait l'ancienne app depuis deux ans
 * (`aggregateFinaleRankings` ne compte que les journées `type = 'finale'`), et sans cette
 * remise à zéro le seuil de victoire de 20 points serait franchi dès les qualifications —
 * la règle n'aurait plus aucun sens.
 *
 * ⚠️ **SUR UN TOURNOI SANS PHASE `finale`, RIEN NE CHANGE** : l'espace « qualification » est
 * alors le tournoi entier, exactement comme avant cette story.
 */
export type EspaceDePoints = "qualification" | "finale";

const placesDeLEspace = (places: readonly PlaceLue[], espace: EspaceDePoints) =>
  places.filter((place) => estDeLaFinale(place.phaseKind) === (espace === "finale"));

/**
 * Le classement d'un **espace de points**, recalculé depuis les manches classées.
 *
 * 🔴 LA TAILLE DE CHAQUE TABLE EST CELLE DE **CETTE** TABLE, et les points la suivent — c'est ce
 * qui les rend justes quand les lobbies font 6, 6 et 5. Le calcul vit dans
 * `lib/tournoi/classement.ts` (`agregerParEngage`) : la lecture publique pose sa propre garde et
 * ne peut donc pas appeler celle-ci, et deux copies trancheraient un jour à l'envers l'une de
 * l'autre.
 *
 * ⚠️ **ELLE REND AUSSI LES ENGAGÉS QUI N'ONT ENCORE RIEN JOUÉ**, à 0 point : une place générée
 * mais pas dépouillée crée quand même sa ligne. C'est voulu — le back-office compose la manche
 * suivante depuis ce classement et doit voir tout le plateau. ⚠️ C'est aussi pourquoi la surface
 * publique ne rend pas cette liste telle quelle : voir `classementPubliable`.
 *
 * @param exigerPublie 🔴 LA GARDE DE LA LECTURE PUBLIQUE, ET ELLE EST **DANS LA REQUÊTE** (voir
 * `lirePlacesClassables`). Une lecture publique qui déléguerait sa garde à son appelant finirait
 * par être appelée d'ailleurs.
 */
export async function getClassement(
  tournoiId: string,
  { espace, exigerPublie = false }: { espace: EspaceDePoints; exigerPublie?: boolean },
) {
  const places = await lirePlacesClassables(tournoiId, exigerPublie);
  return classer(agregerParEngage(placesDeLEspace(places, espace)));
}

/**
 * La finale d'un tournoi : son classement, et **ce qu'elle permet d'affirmer** (Story 10.14).
 *
 * Rend `null` quand le tournoi ne porte **aucune** phase `finale` — le cas de tous les tournois
 * existants. ⚠️ Rendre un objet vide ferait écrire à l'écran « personne n'a encore gagné » sur un
 * tournoi qui n'a pas de finale du tout : une phrase vraie et hors sujet, donc trompeuse.
 *
 * ⚠️ **DEUX LECTURES, PARCE QUE LE SEUIL N'EST PAS DANS LES PLACES** : il vit dans les `settings`
 * de la première phase `finale` (arbitrage de Brice — une manche gouverne tout le bloc, sans quoi
 * deux manches porteraient deux règles sans que rien ne le signale).
 */
export async function getFinale(
  tournoiId: string,
  { exigerPublie = false }: { exigerPublie?: boolean } = {},
) {
  const bloc = await db
    .select({ id: tournamentPhase.id, name: tournamentPhase.name, settings: tournamentPhase.settings })
    .from(tournamentPhase)
    .innerJoin(tournament, eq(tournament.id, tournamentPhase.tournamentId))
    .where(
      exigerPublie
        ? and(
            eq(tournamentPhase.tournamentId, tournoiId),
            eq(tournamentPhase.kind, "finale"),
            eq(tournament.isPublished, true),
          )
        : and(eq(tournamentPhase.tournamentId, tournoiId), eq(tournamentPhase.kind, "finale")),
    )
    .orderBy(asc(tournamentPhase.position));

  if (bloc.length === 0) return null;

  const places = placesDeLEspace(await lirePlacesClassables(tournoiId, exigerPublie), "finale");
  const seuil = seuilDeLaFinale(bloc.map((phase) => ({ seuil: seuilDesReglages(phase.settings) })));

  return {
    manches: bloc.map((phase) => ({ id: phase.id, nom: phase.name })),
    classement: classer(agregerParEngage(places)),
    issue: issueDeLaFinale(manchesDeFinale(places), seuil),
  };
}

/**
 * ⚠️ **`settings` EST UN `jsonb` : CE QUI EN SORT N'EST PAS TYPÉ, QUOI QU'EN DISE TypeScript.**
 * Une restauration de sauvegarde, un `UPDATE` direct ou une phase écrite avant la 10.14 peuvent
 * y mettre n'importe quoi — d'où une lecture défensive plutôt qu'un `as`. Le repli est le seuil
 * par défaut, jamais une erreur : une finale déjà en base porte `{}`.
 */
function seuilDesReglages(settings: unknown): number | null {
  if (typeof settings !== "object" || settings === null) return null;
  const brut = (settings as Record<string, unknown>).seuilDeVictoire;
  return typeof brut === "number" && Number.isInteger(brut) && brut >= 1 ? brut : null;
}

/**
 * Le classement d'un tournoi **PUBLIÉ** (Story 14.2).
 *
 * ⚠️ **ELLE NE FILTRE PAS ELLE-MÊME CE QU'ON A LE DROIT DE NOMMER** — c'est `classementPubliable`
 * qui le fait, dans la lib, parce que **deux** surfaces posent la question : cette page-ci et
 * l'aperçu du bénévole, qui lit un BROUILLON et ne peut donc pas passer par cette requête. La
 * garde de publication et la règle de nommage sont deux choses, à deux endroits, chacune avec
 * son appelant. Les fondre ici laisserait l'aperçu montrer autre chose que le site.
 */
export async function getClassementPublic(tournoiId: string) {
  return getClassement(tournoiId, { espace: "qualification", exigerPublie: true });
}

/**
 * Les engagés PRÉSENTS d'un tournoi, dans l'ordre de saisie.
 *
 * 🔴 `present` ET RIEN D'AUTRE — c'est tout le sens du pointage de la 10.5. Générer depuis les
 * `inscrit` fabriquerait un tableau avec des places que personne n'occupe, et les exemptions
 * iraient aux mauvais joueurs.
 * ⚠️ `abandonne` EST EXCLU AUSSI : il a joué, ses points restent au classement, mais il n'entre
 * pas dans une manche suivante (`lobbiesSuisses` applique déjà la même règle).
 */
export async function getPresentsDuTournoi(tournoiId: string, jour: string | null = null) {
  const engages = await db
    .select({
      id: tournamentEntry.id,
      nom: tournamentEntry.displayName,
      etat: tournamentEntry.state,
    })
    .from(tournamentEntry)
    .where(eq(tournamentEntry.tournamentId, tournoiId))
    .orderBy(asc(tournamentEntry.createdAt), asc(tournamentEntry.id));

  /**
   * 🔴 LE FILTRE N'EST PLUS DANS LE `WHERE`, ET C'EST LE POINT (2026-08-24). Un `state =
   * 'present'` en SQL ne peut pas exprimer « présent CE JOUR-LÀ » : la réponse dépend de deux
   * tables et d'un ordre de priorité. La règle vit donc dans `lib/tournoi/presence.ts`, une
   * seule fois, testée — et le SQL se contente de rapporter les faits.
   * ⚠️ `jour === null` (phase non datée, tournoi d'un jour) ⇒ aucun pointage lu, repli sur
   * l'état global : exactement le comportement d'avant.
   */
  const lignes =
    jour === null
      ? []
      : await db
          .select({
            entryId: tournamentEntryAttendance.entryId,
            playedOn: tournamentEntryAttendance.playedOn,
            state: tournamentEntryAttendance.state,
          })
          .from(tournamentEntryAttendance)
          .innerJoin(
            tournamentEntry,
            eq(tournamentEntry.id, tournamentEntryAttendance.entryId),
          )
          .where(
            and(
              eq(tournamentEntry.tournamentId, tournoiId),
              eq(tournamentEntryAttendance.playedOn, jour),
            ),
          );

  const pointages = pointagesDuJour(lignes, jour);

  return engages
    .filter((engage) => joueCeJourLa(engage.etat, pointages.get(engage.id)))
    .map((engage) => ({ id: engage.id, nom: engage.nom }));
}

/**
 * Vrai dès qu'une place de la phase porte un rang **ou** un score.
 *
 * 🔴 LE TÉMOIN EST LE RÉSULTAT, JAMAIS L'ÉTAT DÉCLARÉ de la phase ou de la rencontre — même
 * doctrine que `phaseLibrementModifiable` (10.1) et que `getPhasesForTournament` (10.4) : l'état
 * est saisi, le résultat est un fait. Se fier à `state` laisserait effacer des scores en
 * remettant une rencontre à « à jouer ».
 *
 * ⚠️ `or(isNotNull(rank), isNotNull(score))` et non un test sur l'un des deux : un bracket se
 * dépouille au score, un lobby au rang. N'en regarder qu'un rendrait la garde inerte sur la
 * moitié des formats — et c'est exactement le genre de garde à moitié posée qui ne se voit pas.
 */
export async function phaseADesResultats(phaseId: string) {
  const [ligne] = await db
    .select({ id: tournamentMatchSlot.id })
    .from(tournamentMatchSlot)
    .innerJoin(tournamentMatch, eq(tournamentMatch.id, tournamentMatchSlot.matchId))
    .where(
      and(
        eq(tournamentMatch.phaseId, phaseId),
        or(isNotNull(tournamentMatchSlot.rank), isNotNull(tournamentMatchSlot.score)),
      ),
    )
    .limit(1);

  return ligne !== undefined;
}
