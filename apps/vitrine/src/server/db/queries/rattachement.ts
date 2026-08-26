import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { clesDeRecherche, inscriptionsSuggerees } from "../../../lib/tournoi/rattachement";
import { db } from "../client";
import {
  tournament,
  tournamentEntry,
  tournamentEntryClaim,
  user,
  userProfile,
} from "../schema";

/**
 * Les inscriptions qu'on peut **proposer** à quelqu'un (Story 12.1, 2/2).
 *
 * 🔴 LA RÈGLE DE RAPPROCHEMENT VIT DANS LA LIB, PAS DANS LE `WHERE`. On pourrait écrire
 * `lower(split_part(display_name, '#', 1))` en SQL — et on aurait alors **deux** définitions du
 * rapprochement, celle de Postgres et celle de `rattachement.ts`, qui divergeraient au premier
 * ajustement. La requête rapporte des **faits**, la lib tranche. C'est la leçon `estParTables`
 * (10.10), et elle vaut d'autant plus que le rapprochement porte sur des données personnelles.
 *
 * ⚠️ **VOLUME ASSUMÉ ET BORNÉ** : on lit les engagés **non réclamés des tournois PUBLIÉS**.
 * À l'échelle de l'association (quelques centaines de lignes), c'est une lecture triviale ; le
 * jour où ça ne l'est plus, la parade est un index sur la forme comparable, pas une seconde
 * règle de rapprochement.
 * ⚠️ **`is_published` FILTRE ICI AUSSI** : proposer une inscription d'un tournoi en brouillon
 * apprendrait son existence à qui n'a rien à en savoir.
 */
export async function getInscriptionsAReclamer(utilisateurId: string) {
  const [profil] = await db
    .select({
      pseudo: userProfile.pseudo,
      discordPseudo: userProfile.discordPseudo,
      riotId: userProfile.riotId,
      steamId: userProfile.steamId,
      epicId: userProfile.epicId,
    })
    .from(userProfile)
    .where(eq(userProfile.userId, utilisateurId))
    .limit(1);

  const cles = clesDeRecherche([
    profil?.pseudo ?? null,
    profil?.discordPseudo ?? null,
    profil?.riotId ?? null,
    profil?.steamId ?? null,
    profil?.epicId ?? null,
  ]);
  // Aucun pseudo déclaré ⇒ aucune clé ⇒ rien à proposer. On s'arrête AVANT la lecture : sans
  // cette sortie, on lirait tout le plateau pour n'en garder rien.
  if (cles.length === 0) return { cles, inscriptions: [] };

  const candidates = await db
    .select({
      id: tournamentEntry.id,
      displayName: tournamentEntry.displayName,
      tournoiNom: tournament.name,
      tournoiSlug: tournament.slug,
      tournoiDate: tournament.startsAt,
      /**
       * ⚠️ CE QUE J'AI **DÉJÀ DEMANDÉ** — sinon l'écran reproposerait une inscription dont la
       * demande est en attente, ou pire, une qu'un bénévole a refusée. Un `left join` plutôt
       * qu'un `not exists` : on veut afficher l'état, pas seulement masquer la ligne.
       */
      etatDemande: tournamentEntryClaim.state,
    })
    .from(tournamentEntry)
    .innerJoin(tournament, eq(tournament.id, tournamentEntry.tournamentId))
    .leftJoin(
      tournamentEntryClaim,
      and(
        eq(tournamentEntryClaim.entryId, tournamentEntry.id),
        eq(tournamentEntryClaim.userId, utilisateurId),
      ),
    )
    .where(and(isNull(tournamentEntry.userId), eq(tournament.isPublished, true)))
    .orderBy(desc(tournament.startsAt));

  return { cles, inscriptions: inscriptionsSuggerees(candidates, cles) };
}

/**
 * Les inscriptions **rattachées** à quelqu'un — son historique de tournois.
 *
 * ⚠️ Aucune notion de résultat ici : la fiche publique du tournoi porte déjà le classement et
 * les rencontres (14.2, 14.3), et les recalculer pour une seconde surface fabriquerait un second
 * classement qui divergerait du premier. Le profil **renvoie** vers la fiche.
 */
export async function getMesInscriptions(utilisateurId: string) {
  return db
    .select({
      id: tournamentEntry.id,
      displayName: tournamentEntry.displayName,
      tournoiNom: tournament.name,
      tournoiSlug: tournament.slug,
      tournoiDate: tournament.startsAt,
      tournoiPublie: tournament.isPublished,
    })
    .from(tournamentEntry)
    .innerJoin(tournament, eq(tournament.id, tournamentEntry.tournamentId))
    .where(eq(tournamentEntry.userId, utilisateurId))
    .orderBy(desc(tournament.startsAt));
}

/**
 * Les réclamations **en attente** sur un tournoi, avec de quoi les juger (Story 12.1, 2/2).
 *
 * 🔴 ON REMONTE LES PSEUDOS DÉCLARÉS DU DEMANDEUR, ET C'EST TOUT L'INTÉRÊT DE L'ÉCRAN. Un
 * bénévole à qui l'on montrerait « quelqu'un réclame ClaraByte » n'aurait **rien pour trancher**
 * — c'est-à-dire qu'il accepterait par défaut, et la validation humaine ne serait qu'une
 * formalité. En voyant l'adresse et les identifiants de jeu, il reconnaît la personne.
 */
export async function getReclamationsDuTournoi(tournoiId: string) {
  return db
    .select({
      id: tournamentEntryClaim.id,
      entryId: tournamentEntry.id,
      engage: tournamentEntry.displayName,
      demandeur: {
        email: user.email,
        pseudo: userProfile.pseudo,
        discordPseudo: userProfile.discordPseudo,
        riotId: userProfile.riotId,
      },
      demandeeLe: tournamentEntryClaim.createdAt,
    })
    .from(tournamentEntryClaim)
    .innerJoin(tournamentEntry, eq(tournamentEntry.id, tournamentEntryClaim.entryId))
    .innerJoin(user, eq(user.id, tournamentEntryClaim.userId))
    .leftJoin(userProfile, eq(userProfile.userId, tournamentEntryClaim.userId))
    .where(
      and(
        eq(tournamentEntry.tournamentId, tournoiId),
        eq(tournamentEntryClaim.state, "en_attente"),
      ),
    )
    .orderBy(desc(tournamentEntryClaim.createdAt));
}

/** Combien de réclamations attendent une décision, tous tournois confondus (bande « Ce qui attend »). */
export async function compterReclamationsEnAttente(): Promise<number> {
  const [ligne] = await db
    .select({ nombre: sql<number>`count(*)`.mapWith(Number) })
    .from(tournamentEntryClaim)
    .where(eq(tournamentEntryClaim.state, "en_attente"));

  return ligne?.nombre ?? 0;
}
