"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  rangsPlaces,
  structureDePhase,
  TAILLE_LOBBY_DEFAUT,
  TAILLE_LOBBY_MAX,
  TAILLE_LOBBY_MIN,
  type SourceResolue,
} from "../../lib/tournoi/generation";
import {
  calculerPropagation,
  issueDeRencontre,
  saisieAdmissible,
  type PlaceJouee,
} from "../../lib/tournoi/progression";
import { podiumDepuis } from "../../lib/tournoi/parcours";
import { participantsDepuisLeClassement } from "../../lib/tournoi/participants";
import { partDuClassement } from "../../lib/tournoi/structure";
import { requireAdmin } from "../auth/guard";
import { db } from "../db/client";
import { getPhasesForTournament } from "../db/queries/phases";
import {
  getClassementDuTournoi,
  getPhasePourJeu,
  getPresentsDuTournoi,
  getRencontresDePhase,
  phaseADesResultats,
  rangsDeLaPhase,
} from "../db/queries/rencontres";
import { tournament, tournamentMatch, tournamentMatchSlot, tournamentPhase } from "../db/schema";
import {
  identifiant,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * Générer et jouer — les rencontres, les résultats, la progression (Story 10.8).
 *
 * Patron d'`actions/phases.ts` (10.4) et d'`actions/engages.ts` (10.5) : `await requireAdmin()`
 * en PREMIÈRE LIGNE, `identifiant` sur tout `id` reçu, retour discriminé.
 *
 * 🔴 CE QUI EST PROPRE À CET ÉCRAN : LA PROPAGATION SE **RECALCULE EN ENTIER**, elle ne s'applique
 * pas par incréments. Voir `propager()`.
 */

const CONTRAINTES: Record<string, string> = {
  tournament_match_position_positive: "Le rang d'une rencontre est invalide. Rechargez la page.",
  tournament_match_round_positive: "Le tour d'une rencontre est invalide. Rechargez la page.",
  tournament_match_ordre_unique: "Deux rencontres occupent le même rang. Rechargez la page.",
  tournament_match_slot_position_positive: "Le rang d'une place est invalide. Rechargez la page.",
  tournament_match_slot_score_positif: "Un score ne peut pas être négatif.",
  tournament_match_slot_rank_positif: "Une place ne peut pas être inférieure à 1.",
  tournament_match_slot_ordre_unique: "Deux places occupent le même rang. Rechargez la page.",
  tournament_match_slot_engage_unique:
    "Le même engagé se retrouverait deux fois dans la même rencontre. C'est un défaut de " +
    "génération : régénérez la phase.",
};

/** Ce que l'écran de génération soumet. Bornes de saisie, pas de règle de tournoi. */
const reglagesSaisis = z.object({
  tailleDeLobby: z.coerce
    .number()
    .int()
    .min(TAILLE_LOBBY_MIN, `Une table compte au moins ${TAILLE_LOBBY_MIN} joueurs.`)
    .max(TAILLE_LOBBY_MAX, `Une table ne peut pas dépasser ${TAILLE_LOBBY_MAX} joueurs.`)
    .default(TAILLE_LOBBY_DEFAUT),
  doubleElimination: z.coerce.boolean().default(false),
  allerRetour: z.coerce.boolean().default(false),
  /**
   * D'où viennent les participants, **et dans quel ORDRE** — la décision qui compte.
   * `presents` : ordre de saisie, pour une première manche. `classement` : ordre du classement,
   * pour une manche suisse ou une finale. `generation.ts` ne tranche pas cet ordre exprès.
   */
  depuis: z.enum(["presents", "classement"]).default("presents"),
});

/**
 * Une place telle que la propagation la manipule en mémoire.
 *
 * ⚠️ Champs MUTABLES, là où `PlaceJouee` (`progression.ts`) les déclare en lecture seule — et
 * c'est volontaire des deux côtés : le dépouillement n'a aucune raison de modifier ce qu'il lit,
 * la propagation en a une (elle avance les occupants d'un tour à l'autre avant de les écrire).
 */
type PlaceEnMemoire = {
  slotId: string;
  position: number;
  entryId: string | null;
  score: number | null;
  rank: number | null;
  source: SourceResolue | null;
};
type RencontreEnMemoire = { matchId: string; position: number; places: PlaceEnMemoire[] };

/** Tout ce qu'une transaction sait faire ; suffisant pour `propager`. */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Applique la propagation : **lire, appeler, écrire**.
 *
 * 🔴 LA DÉCISION N'EST PAS ICI. Elle est dans `calculerPropagation` (`lib/tournoi/progression.ts`),
 * qui est **pure** et testée — parce que c'est la logique la plus risquée de la story (elle fait
 * jouer des gens) et qu'une transaction n'est pas un endroit où on éprouve une règle. Cette
 * fonction ne fait que la traduire en `UPDATE`.
 */
async function propager(tx: Transaction, phaseId: string) {
  const lignes = await tx
    .select({
      matchId: tournamentMatch.id,
      position: tournamentMatch.position,
      slotId: tournamentMatchSlot.id,
      slotPosition: tournamentMatchSlot.position,
      entryId: tournamentMatchSlot.entryId,
      score: tournamentMatchSlot.score,
      rank: tournamentMatchSlot.rank,
      source: tournamentMatchSlot.source,
    })
    .from(tournamentMatch)
    .innerJoin(tournamentMatchSlot, eq(tournamentMatchSlot.matchId, tournamentMatch.id))
    .where(eq(tournamentMatch.phaseId, phaseId))
    .orderBy(asc(tournamentMatch.position), asc(tournamentMatchSlot.position));

  const parPosition = new Map<number, RencontreEnMemoire>();
  for (const ligne of lignes) {
    let rencontre = parPosition.get(ligne.position);
    if (!rencontre) {
      rencontre = { matchId: ligne.matchId, position: ligne.position, places: [] };
      parPosition.set(ligne.position, rencontre);
    }
    rencontre.places.push({
      slotId: ligne.slotId,
      position: ligne.slotPosition,
      entryId: ligne.entryId,
      score: ligne.score,
      rank: ligne.rank,
      source: (ligne.source as SourceResolue | null) ?? null,
    });
  }

  const { deplacements, issues } = calculerPropagation([...parPosition.values()]);
  const etats = [...issues.entries()].map(([matchId, issue]) => ({
    matchId,
    termine: issue.complete,
  }));

  for (const deplacement of deplacements) {
    await tx
      .update(tournamentMatchSlot)
      .set({ entryId: deplacement.entryId, score: null, rank: null })
      .where(eq(tournamentMatchSlot.id, deplacement.slotId));
  }

  /**
   * ⚠️ `state` EST TENU À JOUR MAIS **AUCUNE DÉCISION N'EN DÉPEND** — le témoin reste le
   * RÉSULTAT (doctrine `phaseLibrementModifiable`, 10.1). Il est écrit parce que la colonne
   * existe et qu'une valeur périmée dans le modèle est une invitation à s'y fier ; il n'est
   * jamais lu pour autoriser ou refuser quoi que ce soit.
   */
  const termines = etats.filter((e) => e.termine).map((e) => e.matchId);
  const enAttente = etats.filter((e) => !e.termine).map((e) => e.matchId);
  if (termines.length > 0) {
    await tx
      .update(tournamentMatch)
      .set({ state: "terminee", updatedAt: new Date() })
      .where(inArray(tournamentMatch.id, termines));
  }
  if (enAttente.length > 0) {
    await tx
      .update(tournamentMatch)
      .set({ state: "a_jouer", updatedAt: new Date() })
      .where(inArray(tournamentMatch.id, enAttente));
  }

  /**
   * ⚠️ L'ÉTAT DE LA PHASE SE DÉRIVE AUSSI — défaut constaté sur le tournoi réel de Brice : ses
   * deux phases restaient `en_cours` alors que **toutes** leurs rencontres étaient `terminee`, et
   * l'écran du déroulé (10.4) l'affichait tel quel. Un état qui ne suit pas les faits est une
   * invitation à s'y fier.
   * ⚠️ `planifiee` n'est PAS rétabli ici : c'est l'état d'avant génération, et
   * `effacerRencontres` est le seul geste qui y ramène.
   */
  if (etats.length > 0) {
    await tx
      .update(tournamentPhase)
      .set({
        state: enAttente.length === 0 ? "terminee" : "en_cours",
        updatedAt: new Date(),
      })
      .where(eq(tournamentPhase.id, phaseId));
  }

  return { deplacements: deplacements.length, termines: termines.length };
}

/**
 * Pré-remplit le podium du tournoi depuis les résultats — **et un humain valide**.
 *
 * 🔴 NÉ DU TOURNOI RÉEL DE BRICE (2026-08-15) : sa grande finale avait un vainqueur, et le podium
 * de `tournament` était **vide**, à taper à la main. Rien ne reliait ce que le moteur savait à ce
 * que le site publie.
 *
 * 🔴 LE PODIUM VIENT DE LA **DERNIÈRE** PHASE QUI DÉSIGNE UN RANG, et c'est la seule règle
 * défendable : c'est elle qui départage. Prendre la première, ou fusionner les phases, ferait
 * dépendre le podium d'une poule de qualification.
 *
 * ⚠️ IL N'INVENTE JAMAIS UNE PLACE DISPUTÉE. Deux demi-finalistes sont 3ᵉ ex æquo : en écrire un
 * seul serait une invention (`podiumDepuis`). La place reste vide et l'écran le dit.
 * ⚠️ **IL ÉCRASE** un podium déjà saisi — d'où la confirmation côté écran. Pré-remplir sans le
 * dire ferait perdre une saisie manuelle sans un mot.
 */
export async function prerremplirPodium(
  tournoiId: string,
): Promise<ResultatAction<{ premier: string | null; deuxieme: string | null; troisieme: string | null; phase: string }>> {
  await requireAdmin();

  if (!identifiant.safeParse(tournoiId).success) {
    return { ok: false, error: "Ce tournoi n'est pas valide. Rechargez la page." };
  }

  const phases = await getPhasesForTournament(tournoiId);
  if (phases.length === 0) {
    return { ok: false, error: "Ce tournoi n'a pas de déroulé : il n'y a rien d'où déduire un podium." };
  }

  // De la dernière phase vers la première : la première qui sait départager l'emporte.
  for (const phase of [...phases].reverse()) {
    const rencontres = await getRencontresDePhase(phase.id);
    if (rencontres.length === 0) continue;

    const rangs = rangsDeLaPhase(phase.kind, rencontres);

    let proposition: { premier: string | null; deuxieme: string | null; troisieme: string | null };
    if (rangs) {
      if (!rangs.termine) continue;
      proposition = podiumDepuis(rangs.lignes, rangs.nomParEngage);
    } else {
      // Phase de tables : c'est le classement AUX POINTS qui départage, pas le parcours.
      const classement = await getClassementDuTournoi(tournoiId);
      if (classement.length === 0) continue;
      proposition = {
        premier: classement[0]?.nom ?? null,
        deuxieme: classement[1]?.nom ?? null,
        troisieme: classement[2]?.nom ?? null,
      };
    }

    if (proposition.premier === null) continue;

    try {
      await db
        .update(tournament)
        .set({
          podiumFirst: proposition.premier,
          podiumSecond: proposition.deuxieme,
          podiumThird: proposition.troisieme,
          updatedAt: new Date(),
        })
        .where(eq(tournament.id, tournoiId));

      return { ok: true, data: { ...proposition, phase: phase.name } };
    } catch (erreur) {
      console.error("[prerremplirPodium] Échec de l'écriture :", erreur);
      return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
    }
  }

  return {
    ok: false,
    error:
      "Aucune phase ne désigne encore de vainqueur sans ambiguïté. Terminez une phase — ou " +
      "saisissez le podium à la main depuis la fiche du tournoi.",
  };
}

/**
 * Génère les rencontres d'une phase depuis les participants.
 *
 * 🔴 REFUSÉE DÈS QU'UN RÉSULTAT EXISTE. Régénérer détruit les rencontres (`CASCADE` sur les
 * places) : sur une phase déjà jouée, ce serait effacer l'histoire sans un mot. Le témoin est le
 * résultat, jamais l'état déclaré.
 *
 * 🔴 ET LES RÉGLAGES CHOISIS ICI SONT **ENREGISTRÉS** dans `phase.settings`. Ce n'est pas une
 * commodité : c'est ce qui les rend atteignables. La 10.5 a buté sur `team_size`, écrit nulle
 * part, donc une capacité entière hors d'atteinte — on ne refait pas ça. Le formulaire de
 * génération est le seul endroit où « une table de 8 » et « double élimination » ont un sens :
 * on annonce un tournoi des semaines avant, on choisit son format quand on sait qui est là.
 */
export async function genererPhase(
  phaseId: string,
  donnees: FormData,
): Promise<ResultatAction<{ rencontres: number; participants: number }>> {
  await requireAdmin();

  if (!identifiant.safeParse(phaseId).success) {
    return { ok: false, error: "Cette phase n'est pas valide. Rechargez la page." };
  }

  const phase = await getPhasePourJeu(phaseId);
  if (!phase) return { ok: false, error: "Cette phase n'existe plus. Rechargez la page." };

  if (await phaseADesResultats(phaseId)) {
    return {
      ok: false,
      error:
        "Des résultats sont déjà saisis dans cette phase : elle ne se régénère plus. " +
        "Corrigez les rencontres concernées, ou créez une phase supplémentaire depuis le déroulé.",
    };
  }

  const analyse = reglagesSaisis.safeParse({
    tailleDeLobby: donnees.get("tailleDeLobby") ?? undefined,
    doubleElimination: donnees.get("doubleElimination") ?? false,
    allerRetour: donnees.get("allerRetour") ?? false,
    depuis: donnees.get("depuis") ?? undefined,
  });
  if (!analyse.success) {
    return { ok: false, error: analyse.error.issues[0]?.message ?? "Vérifiez les réglages." };
  }
  const reglages = analyse.data;

  // 🔴 L'ORDRE DES PARTICIPANTS EST UNE DÉCISION, ET ELLE EST PRISE ICI — jamais dans
  // `generation.ts`, qui l'ignore exprès. Un premier tour part de l'ordre de saisie ; une manche
  // suisse ou une finale partent du CLASSEMENT, sinon les meilleurs ne se rencontrent pas.
  //
  // 🔴 UNE PHASE `suisse` NE LAISSE PAS LE CHOIX, ET C'EST TOUT SON INTÉRÊT. « Suisse » veut
  // dire « composé d'après le classement » : le générer dans l'ordre de saisie n'en ferait pas
  // une manche suisse un peu approximative, ça n'en ferait pas une manche suisse du tout. La
  // règle vit donc dans le FORMAT et non dans une case à cocher qu'on oublie au 3e week-end.
  const depuisLeClassement = partDuClassement(phase.kind) || reglages.depuis === "classement";

  /**
   * 🔴 ON PART TOUJOURS DES PRÉSENTS ; LE CLASSEMENT NE DONNE QUE L'ORDRE (correctif du
   * 2026-08-24). La version d'avant lisait le classement filtré sur `!abandonne`, et se
   * trompait des DEUX côtés, en silence : un présent qui n'avait pas encore joué n'était dans
   * aucune table (il n'apparaît pas dans un classement construit depuis les places), et un
   * ABSENT déjà classé gardait une chaise à chaque manche — sa table jouait à sept.
   * Le moteur TFT historique traitait le premier cas en toutes lettres ; voir `participants.ts`.
   */
  const presents = await getPresentsDuTournoi(phase.tournoiId);

  const participants = depuisLeClassement
    ? participantsDepuisLeClassement(
        (await getClassementDuTournoi(phase.tournoiId)).map((ligne) => ({
          id: ligne.id,
          nom: ligne.nom,
        })),
        presents,
      )
    : presents;

  // ⚠️ UN SEUL MESSAGE, ET IL EST REDEVENU VRAI. Il y en avait trois, dont deux parlaient
  // d'un classement absent — impossible désormais : on part des présents, donc une liste vide
  // ne peut avoir qu'une cause. Une phase suisse jouée sans classement n'échoue plus, elle
  // part de l'ordre d'arrivée ; c'est l'écran du jour J qui le DIT avant de générer.
  if (participants.length === 0) {
    return {
      ok: false,
      error:
        "Aucun engagé n'est pointé « présent ». Pointez-les d'abord depuis l'écran des engagés.",
    };
  }

  let structure;
  try {
    structure = structureDePhase(phase.kind, participants.length, reglages);
  } catch (erreur) {
    // `structureDePhase` LÈVE sur une coordonnée introuvable — c'est un défaut de traduction,
    // pas une saisie fautive. On le remonte lisiblement plutôt que de l'écrire en base.
    console.error("[genererPhase] Traduction impossible :", erreur);
    return {
      ok: false,
      error:
        "La structure n'a pas pu être construite pour cet effectif. C'est un défaut du " +
        "générateur, pas de votre saisie — signalez-le.",
    };
  }

  if (structure.length === 0) {
    return {
      ok: false,
      error: `${participants.length} participant(s) : ce n'est pas assez pour générer des rencontres.`,
    };
  }

  /**
   * 🔴 AUCUN PRÉSENT NE DOIT ÊTRE OUBLIÉ, ET C'EST UNE GARDE, PAS UNE VÉRIFICATION DE POLITESSE.
   * Un engagé pointé présent qui n'apparaît dans aucune rencontre est un défaut **muet** : le
   * tournoi tourne sans lui, personne ne voit d'erreur, et lui attend.
   */
  const places = rangsPlaces(structure);
  const oublies = participants.filter((_, index) => !places.has(index + 1));
  if (oublies.length > 0) {
    console.error("[genererPhase] Participants sans place :", oublies.map((p) => p.nom));
    return {
      ok: false,
      error:
        `La structure générée laisse ${oublies.length} participant(s) sans place ` +
        `(${oublies.map((p) => p.nom).join(", ")}). Rien n'a été enregistré.`,
    };
  }

  try {
    const rencontres = await db.transaction(async (tx) => {
      // Régénérer remplace : les anciennes rencontres partent, et leurs places avec elles
      // (`CASCADE`). La garde ci-dessus a déjà établi qu'aucun résultat n'y était saisi.
      await tx.delete(tournamentMatch).where(eq(tournamentMatch.phaseId, phaseId));

      for (const rencontre of structure) {
        const [ligne] = await tx
          .insert(tournamentMatch)
          .values({
            phaseId,
            position: rencontre.position,
            round: rencontre.round,
            bracket: rencontre.bracket,
          })
          .returning({ id: tournamentMatch.id });

        await tx.insert(tournamentMatchSlot).values(
          rencontre.places.map((place) => ({
            matchId: ligne.id,
            position: place.position,
            // Seules les têtes de série sont pourvues d'emblée. Les autres places attendent la
            // propagation — et une place de tête de série `null` est une exemption.
            entryId:
              place.source.de === "tete_de_serie" && place.source.rang !== null
                ? participants[place.source.rang - 1].id
                : null,
            source: place.source,
          })),
        );
      }

      // Résout les exemptions dans le même geste : un tableau de 8 pour 5 présents fait monter
      // trois joueurs d'office, et personne n'a à cliquer sur des rencontres qui n'ont pas eu
      // lieu. C'est la MÊME fonction que celle qui propage un résultat saisi.
      await propager(tx, phaseId);

      await tx
        .update(tournamentPhase)
        .set({
          settings: {
            tailleDeLobby: reglages.tailleDeLobby,
            doubleElimination: reglages.doubleElimination,
            allerRetour: reglages.allerRetour,
            depuis: reglages.depuis,
          },
          state: "en_cours",
          updatedAt: new Date(),
        })
        .where(eq(tournamentPhase.id, phaseId));

      return structure.length;
    });

    return { ok: true, data: { rencontres, participants: participants.length } };
  } catch (erreur) {
    console.error("[genererPhase] Échec de l'écriture :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}

/**
 * Saisit le résultat d'une rencontre, puis rejoue la propagation de toute la phase.
 *
 * ⚠️ Une saisie **partielle** s'enregistre (on remplit un lobby de 8 au fur et à mesure) ; une
 * saisie **fausse** non. La frontière est tenue par `saisieAdmissible` (`progression.ts`), et
 * elle n'est PAS réécrite ici : deux définitions des règles de rang divergeraient de celle du
 * dépouillement.
 */
export async function saisirResultat(
  matchId: string,
  donnees: FormData,
): Promise<ResultatAction<{ complete: boolean; raison: string | null }>> {
  await requireAdmin();

  if (!identifiant.safeParse(matchId).success) {
    return { ok: false, error: "Cette rencontre n'est pas valide. Rechargez la page." };
  }

  const [rencontre] = await db
    .select({ phaseId: tournamentMatch.phaseId })
    .from(tournamentMatch)
    .where(eq(tournamentMatch.id, matchId))
    .limit(1);
  if (!rencontre) return { ok: false, error: "Cette rencontre n'existe plus. Rechargez la page." };

  const placesEnBase = await db
    .select({
      slotId: tournamentMatchSlot.id,
      position: tournamentMatchSlot.position,
      entryId: tournamentMatchSlot.entryId,
    })
    .from(tournamentMatchSlot)
    .where(eq(tournamentMatchSlot.matchId, matchId))
    .orderBy(asc(tournamentMatchSlot.position));

  /**
   * ⚠️ UN CHAMP VIDE VAUT « PAS SAISI » (`null`), ET JAMAIS ZÉRO. Confondre les deux effacerait
   * un résultat en croyant ne rien toucher — c'est le motif exact de `lireHeureDeFin`
   * (`_commun.ts`) : on ne transforme pas une absence en valeur.
   * ⚠️ En revanche une valeur ILLISIBLE n'est pas non plus une absence : elle est refusée, pour
   * qu'une faute de frappe ne vide pas silencieusement la place.
   */
  const lire = (champ: string): number | null | "illisible" => {
    const brut = donnees.get(champ);
    if (brut === null) return null;
    const texte = String(brut).trim();
    if (texte === "") return null;
    const nombre = Number(texte);
    return Number.isInteger(nombre) ? nombre : "illisible";
  };

  const saisie: PlaceJouee[] = [];
  for (const place of placesEnBase) {
    const rank = lire(`rang-${place.slotId}`);
    const score = lire(`score-${place.slotId}`);
    if (rank === "illisible" || score === "illisible") {
      return {
        ok: false,
        error: "Une valeur saisie n'est pas un nombre entier. Rien n'a été enregistré.",
      };
    }
    saisie.push({ position: place.position, entryId: place.entryId, score, rank });
  }

  const admissible = saisieAdmissible(saisie);
  if (!admissible.ok) return { ok: false, error: admissible.raison };

  try {
    const issue = await db.transaction(async (tx) => {
      for (let i = 0; i < placesEnBase.length; i += 1) {
        await tx
          .update(tournamentMatchSlot)
          .set({ rank: saisie[i].rank, score: saisie[i].score })
          .where(eq(tournamentMatchSlot.id, placesEnBase[i].slotId));
      }
      await propager(tx, rencontre.phaseId);
      return issueDeRencontre(saisie);
    });

    return { ok: true, data: { complete: issue.complete, raison: issue.raison } };
  } catch (erreur) {
    console.error("[saisirResultat] Échec de l'écriture :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}

/**
 * Efface les rencontres d'une phase — refusé dès qu'un résultat existe.
 *
 * ⚠️ Le geste nominal n'est PAS celui-ci mais « régénérer » : effacer laisse une phase composée
 * mais vide, ce qui n'est utile que pour repartir d'un effectif changé. Le dire à l'écran évite
 * de chercher ce que ce bouton apporte de plus.
 */
export async function effacerRencontres(phaseId: string): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(phaseId).success) {
    return { ok: false, error: "Cette phase n'est pas valide. Rechargez la page." };
  }

  if (await phaseADesResultats(phaseId)) {
    return {
      ok: false,
      error:
        "Des résultats sont saisis dans cette phase : ses rencontres ne s'effacent plus. " +
        "Corrigez-les d'abord si c'est une erreur de saisie.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.delete(tournamentMatch).where(eq(tournamentMatch.phaseId, phaseId));
      await tx
        .update(tournamentPhase)
        .set({ state: "planifiee", updatedAt: new Date() })
        .where(and(eq(tournamentPhase.id, phaseId)));
    });
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[effacerRencontres] Échec de la suppression :", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CONTRAINTES) };
  }
}
