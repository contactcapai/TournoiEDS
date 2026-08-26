import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "../client";
import { eventAttendance } from "../schema";

/**
 * Qui a annoncé sa venue (Story 12.2).
 *
 * ⚠️ **DEUX LECTURES POUR DEUX PUBLICS, ET ELLES NE SE MÉLANGENT PAS.** Le visiteur a besoin de
 * savoir ce que **lui** a annoncé — pas combien d'autres viennent. L'association a besoin du
 * **nombre**, et c'est une information de back-office : l'afficher publiquement dessinerait un
 * compteur qui ressemble à des places disponibles, alors qu'il n'y a **ni capacité ni
 * validation**. L'Epic 12 écarte ce défaut nommément.
 */

/**
 * Les événements, parmi ceux affichés, que **ce compte** a déjà annoncés.
 *
 * ⚠️ **BORNÉE AUX ÉVÉNEMENTS DE LA PAGE** (`inArray`) plutôt que « toutes mes intentions » : la
 * page n'en affiche qu'une poignée, et lire l'historique entier pour cocher trois boutons
 * grossirait avec le temps sans que rien ne le montre.
 * ⚠️ **LISTE VIDE ⇒ AUCUNE REQUÊTE.** Un `inArray` sur un tableau vide est un SQL invalide chez
 * certains pilotes ; ici on s'arrête avant, ce qui est de toute façon la bonne réponse.
 */
export async function mesVenues(
  utilisateurId: string,
  evenementIds: readonly string[],
): Promise<Set<string>> {
  if (evenementIds.length === 0) return new Set();

  const lignes = await db
    .select({ eventId: eventAttendance.eventId })
    .from(eventAttendance)
    .where(
      and(
        eq(eventAttendance.userId, utilisateurId),
        inArray(eventAttendance.eventId, [...evenementIds]),
      ),
    );

  return new Set(lignes.map((ligne) => ligne.eventId));
}

/**
 * Combien de personnes s'annoncent, par événement — **back-office seulement**.
 *
 * ⚠️ C'est un **ordre de grandeur pour préparer une soirée**, jamais une liste de places : une
 * intention n'est ni une inscription, ni un engagement. L'écran qui l'affiche doit le dire.
 */
export async function compterVenuesParEvenement(
  evenementIds: readonly string[],
): Promise<Map<string, number>> {
  if (evenementIds.length === 0) return new Map();

  const lignes = await db
    .select({
      eventId: eventAttendance.eventId,
      nombre: sql<number>`count(*)`.mapWith(Number),
    })
    .from(eventAttendance)
    .where(inArray(eventAttendance.eventId, [...evenementIds]))
    .groupBy(eventAttendance.eventId);

  return new Map(lignes.map((ligne) => [ligne.eventId, ligne.nombre]));
}
