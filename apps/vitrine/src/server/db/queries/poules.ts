import "server-only";

import { and, asc, eq, isNotNull } from "drizzle-orm";

import { poulesPubliques, type PoulePublique } from "../../../lib/tournoi/poules-publiques";
import { db } from "../client";
import {
  tournament,
  tournamentEntry,
  tournamentMatch,
  tournamentMatchSlot,
  tournamentPhase,
} from "../schema";
import { getRencontresDePhase } from "./rencontres";

/** Une phase de poules telle que le public (fiche, overlay) la lit. */
export type PhaseDePoules = {
  id: string;
  name: string;
  playedOn: string | null;
  poules: PoulePublique[];
};

/**
 * Le classement de chaque poule du tournoi, qualifiés compris. La garde `is_published` est DANS
 * la lecture (patron `getDeroulePublic`) ; l'aperçu du bénévole la lève explicitement.
 * « Qualifié » = placé dans le tableau tiré « depuis les poules » qui suit : un fait, pas un calcul.
 */
export async function getPoulesPubliques(
  tournoiId: string,
  exigerPublie = true,
): Promise<PhaseDePoules[]> {
  const phases = await db
    .select({
      id: tournamentPhase.id,
      name: tournamentPhase.name,
      kind: tournamentPhase.kind,
      playedOn: tournamentPhase.playedOn,
      settings: tournamentPhase.settings,
    })
    .from(tournamentPhase)
    .innerJoin(tournament, eq(tournament.id, tournamentPhase.tournamentId))
    .where(
      exigerPublie
        ? and(eq(tournamentPhase.tournamentId, tournoiId), eq(tournament.isPublished, true))
        : eq(tournamentPhase.tournamentId, tournoiId),
    )
    .orderBy(asc(tournamentPhase.position));

  if (!phases.some((phase) => phase.kind === "poule")) return [];

  const engages = new Map(
    (
      await db
        .select({ id: tournamentEntry.id, nom: tournamentEntry.displayName, etat: tournamentEntry.state })
        .from(tournamentEntry)
        .where(eq(tournamentEntry.tournamentId, tournoiId))
    ).map((engage) => [engage.id, { nom: engage.nom, etat: engage.etat }]),
  );

  const resultat: PhaseDePoules[] = [];
  for (const [rang, phase] of phases.entries()) {
    if (phase.kind !== "poule") continue;
    const rencontres = await getRencontresDePhase(phase.id);
    if (rencontres.length === 0) continue;

    const suivante = phases[rang + 1];
    const depuisLesPoules =
      suivante?.kind === "bracket" &&
      typeof suivante.settings === "object" &&
      suivante.settings !== null &&
      (suivante.settings as Record<string, unknown>).depuis === "poules";
    const qualifies = depuisLesPoules
      ? new Set(
          (
            await db
              .selectDistinct({ id: tournamentMatchSlot.entryId })
              .from(tournamentMatchSlot)
              .innerJoin(tournamentMatch, eq(tournamentMatch.id, tournamentMatchSlot.matchId))
              .where(
                and(eq(tournamentMatch.phaseId, suivante.id), isNotNull(tournamentMatchSlot.entryId)),
              )
          ).flatMap((ligne) => (ligne.id === null ? [] : [ligne.id])),
        )
      : new Set<string>();

    resultat.push({
      id: phase.id,
      name: phase.name,
      playedOn: phase.playedOn,
      poules: poulesPubliques(rencontres, engages, qualifies),
    });
  }
  return resultat;
}
