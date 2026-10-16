import "server-only";

import { asc } from "drizzle-orm";

import { db } from "../client";
import { rulesTemplate } from "../schema";

/** Les modèles de règlement, texte compris : le formulaire du tournoi les remplit côté client. */
export async function getModelesReglement() {
  return db.query.rulesTemplate.findMany({
    columns: { id: true, name: true, body: true, updatedAt: true },
    orderBy: asc(rulesTemplate.name),
  });
}

export type ModeleReglement = Awaited<ReturnType<typeof getModelesReglement>>[number];

export async function getModeleReglementById(id: string) {
  return db.query.rulesTemplate.findFirst({
    columns: { id: true, name: true, body: true },
    where: (table, { eq }) => eq(table.id, id),
  });
}

/** Le règlement d'un tournoi PUBLIÉ — `undefined` s'il n'est pas publié ou n'en a pas. */
export async function getReglementPublic(slug: string) {
  const ligne = await db.query.tournament.findFirst({
    columns: { name: true, slug: true, game: true, rules: true },
    where: (table, { and, eq, isNotNull }) =>
      and(eq(table.isPublished, true), eq(table.slug, slug), isNotNull(table.rules)),
  });
  return ligne?.rules ? { ...ligne, rules: ligne.rules } : undefined;
}
