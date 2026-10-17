import type { PhaseKind, PhaseState } from "./structure";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LES DEUX OVERLAYS PARTAGENT (Story 10.6)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ Trois broutilles, mais **deux consommateurs chacune** — et une valeur recopiée dans deux
 * pages jumelles est exactement ce qui diverge (dette R37, `texteOptionnel` en trois
 * exemplaires pendant quatre stories).
 */

/**
 * Le rythme du rafraîchissement, en secondes.
 *
 * 🔴 **10 s PARCE QUE LE CLASSEMENT NE BOUGE QU'À LA FIN D'UNE MANCHE**, c'est-à-dire toutes
 * les quinze minutes environ. Cette valeur borne donc le **retard maximal** d'une incrustation,
 * pas sa fluidité : la descendre coûterait des requêtes sans rien montrer de plus.
 * ⚠️ Elle n'est **pas** réglable par l'URL, et c'est délibéré : aucun besoin mesuré, et un
 * paramètre de plus est un paramètre que le caster peut se tromper en saisissant un soir de
 * direct.
 */
export const RAFRAICHISSEMENT_SECONDES = 10;

/**
 * `?transparent=1` — le fond disparaît pour le chroma key.
 *
 * ⚠️ **UNE SEULE VALEUR ACCEPTÉE, `"1"`**, et c'est le contrat de l'ancienne app repris tel
 * quel (`searchParams.get('transparent') === '1'`) : les URLs déjà notées dans les fiches du
 * caster gardent le même sens. Accepter `true`/`oui`/`on` en plus élargirait un contrat que
 * personne n'a demandé d'élargir.
 * ⚠️ Next rend un **tableau** quand un paramètre est répété (`?transparent=1&transparent=0`) :
 * sans ce garde, la comparaison porterait sur un tableau et rendrait toujours `false` — donc
 * un fond opaque à l'antenne, sans erreur.
 */
export function estTransparent(valeur: string | string[] | undefined): boolean {
  const premiere = Array.isArray(valeur) ? valeur[0] : valeur;
  return premiere === "1";
}

/**
 * L'heure du rendu **serveur**, à la seconde, à l'horloge de Paris.
 *
 * 🔴 C'EST LE TÉMOIN QUI PAIE L'ABANDON DU SOCKET. Si le site tombe, le rafraîchissement échoue
 * **en silence** et l'incrustation garde à l'écran un classement figé qui **a l'air à jour**.
 * L'heure qui cesse d'avancer est la seule chose qui le dise au caster.
 * ⚠️ **Les secondes sont nécessaires** : à 10 s de rythme, une heure sans secondes semblerait
 * figée pendant une minute entière — le témoin accuserait à tort, ce qui est pire qu'aucun
 * témoin (on apprendrait à ne plus le regarder).
 * ⚠️ `Europe/Paris` **explicitement** : le conteneur tourne en UTC, et un overlay qui afficherait
 * une heure décalée de deux heures ferait croire à un gel — juste en local, faux sur le VPS,
 * sans erreur ni test rouge (doctrine `date-paris.ts`).
 */
export function heureDeFraicheur(instant: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(instant);
}

/** Ce que l'overlay principal montre : il suit le format de la phase EN COURS. */
export type VueOverlay = "points" | "poules" | "tableau";

/**
 * La phase en cours = la dernière lancée (la génération la passe « en cours », et rien ne
 * referme les précédentes). Poules et tableau ont leur vue ; tout le reste (tables, finale,
 * rien de lancé) garde le classement aux points.
 */
export function vueDeLOverlay<P extends { kind: PhaseKind; state: PhaseState }>(
  phases: readonly P[],
): { vue: VueOverlay; phase: P | null } {
  const phase = phases.findLast((p) => p.state !== "planifiee") ?? null;
  if (phase?.kind === "poule") return { vue: "poules", phase };
  if (phase?.kind === "bracket") return { vue: "tableau", phase };
  return { vue: "points", phase };
}

/**
 * Le tour en cours d'un tableau : le premier groupe qui a une rencontre JOUABLE (pas de
 * résultat, deux noms connus — une exemption n'en a qu'un), et le suivant « à venir ».
 * Plus rien de jouable : le dernier groupe qui a des résultats.
 */
export function tourCourant<
  G extends { rencontres: readonly { depouillee: boolean; places: readonly { nom: string | null }[] }[] },
>(groupes: readonly G[]): { courant: G | null; suivant: G | null; termine: boolean } {
  const jouable = (r: G["rencontres"][number]) =>
    !r.depouillee && r.places.length > 1 && r.places.every((p) => p.nom !== null);
  const rang = groupes.findIndex((g) => g.rencontres.some(jouable));
  if (rang !== -1) return { courant: groupes[rang], suivant: groupes[rang + 1] ?? null, termine: false };
  const joue = groupes.findLast((g) => g.rencontres.some((r) => r.depouillee)) ?? null;
  return { courant: joue, suivant: null, termine: joue !== null };
}
