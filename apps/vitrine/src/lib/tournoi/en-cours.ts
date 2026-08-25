import type { PhaseState } from "./structure";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CE QUI SE JOUE MAINTENANT — LA RÈGLE, ET ELLE EST PARTAGÉE (Epic 14)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CE FICHIER EXISTE PARCE QUE DEUX LECTURES POSENT LA MÊME QUESTION. Le tableau de bord
 * du back-office (13.3) demande « quels tournois se jouent ces jours-ci » ; la liste publique
 * `/tournois` demande « lesquels se jouent aujourd'hui ». Écrire la fusion des deux sources
 * dans chacune des deux, c'est la recopie qui a déjà coûté un défaut muet au 5ᵉ cas sur ce
 * projet (leçon `estParTables`, 10.10). Une seule règle, deux appelants, un test.
 *
 * ⚠️ CE FICHIER NE CONNAÎT PAS LA BASE : il reçoit des lignes déjà lues et déjà converties en
 * jours de Paris. C'est ce qui permet de l'éprouver sans Postgres.
 */

/** Un tournoi trouvé par une **journée de son déroulé** (`played_on`). */
export type CandidatParJournee = { id: string; nom: string; journee: string };

/** Un tournoi trouvé par sa **date de début**, déjà convertie en jour de Paris. */
export type CandidatParDebut = { id: string; nom: string; jour: string };

/** Un tournoi qui se joue, et le jour où. */
export type CeQuiSeJoue = { id: string; nom: string; journee: string };

/**
 * Fusionne les deux sources en une liste ordonnée, sans doublon.
 *
 * 🔴 LE DÉROULÉ L'EMPORTE SUR LA DATE DE DÉBUT quand les deux répondent pour un même tournoi.
 * `played_on` est ce que quelqu'un a écrit **journée par journée** ; `starts_at` est la date
 * d'ouverture du tournoi. Les deux sont vraies, l'une est plus précise. ⚠️ Cette préséance est
 * la **même** que celle de `etatDuJour` ci-dessous : deux règles voisines qui trancheraient à
 * l'envers l'une de l'autre feraient dire à la liste et à la fiche des choses différentes du
 * même tournoi, le même jour.
 *
 * ⚠️ L'ordre est **TOTAL** — la journée, puis le nom, puis l'identifiant. Les pages qui
 * l'affichent sont `force-dynamic` : sans le dernier terme, deux tournois de même jour et de
 * même nom se réordonneraient d'une visite à l'autre.
 */
export function fusionnerCeQuiSeJoue(
  parJournee: readonly CandidatParJournee[],
  parDebut: readonly CandidatParDebut[],
): CeQuiSeJoue[] {
  const parTournoi = new Map<string, CeQuiSeJoue>();

  for (const ligne of parJournee) {
    parTournoi.set(ligne.id, { id: ligne.id, nom: ligne.nom, journee: ligne.journee });
  }
  for (const ligne of parDebut) {
    if (parTournoi.has(ligne.id)) continue;
    parTournoi.set(ligne.id, { id: ligne.id, nom: ligne.nom, journee: ligne.jour });
  }

  return [...parTournoi.values()].sort(
    (a, b) =>
      a.journee.localeCompare(b.journee) ||
      a.nom.localeCompare(b.nom, "fr") ||
      a.id.localeCompare(b.id, "fr"),
  );
}

/** Ce qu'une phase doit porter pour que la règle ci-dessous se prononce. */
export type PhaseDuDeroule = { name: string; state: PhaseState; playedOn: string | null };

/**
 * Ce qu'on peut dire d'un tournoi à l'instant où on le regarde.
 *
 * ⚠️ Trois natures, pas deux : « une manche est en cours » est un fait **saisi par
 * l'organisateur**, « ça se joue aujourd'hui » n'est qu'un fait **de calendrier**. Les
 * confondre ferait annoncer qu'une manche se joue alors que personne n'a encore rien lancé.
 */
export type EtatDuJour =
  | { nature: "manche_en_cours"; manche: string }
  | { nature: "aujourd_hui" }
  | { nature: "rien" };

/**
 * 🔴 L'ORDRE DES TROIS RÈGLES EST LA RÈGLE — le plus fort d'abord.
 *
 * ① Une phase `en_cours` l'emporte sur tout : quelqu'un l'a **déclarée** lancée, et c'est plus
 *    sûr que n'importe quel calcul de date.
 * ② Sinon, une phase datée d'aujourd'hui : le déroulé dit que ça se joue.
 * ③ Sinon **et seulement si AUCUNE phase n'est datée**, la date de début du tournoi. La
 *    condition « aucune phase datée » n'est pas une précaution : sur un tournoi étalé sur
 *    plusieurs week-ends (10.10), `starts_at` est le **premier** jour et le rester à jamais —
 *    sans elle, un TFT de trois samedis s'annoncerait « ça se joue » tous les jours du premier.
 *
 * ⚠️ Même préséance que `fusionnerCeQuiSeJoue` : le déroulé bat la date de début.
 */
export function etatDuJour(
  phases: readonly PhaseDuDeroule[],
  jourDeDebut: string,
  aujourdHui: string,
): EtatDuJour {
  const enCours = phases.find((phase) => phase.state === "en_cours");
  if (enCours) return { nature: "manche_en_cours", manche: enCours.name };

  const datees = phases.filter((phase) => phase.playedOn !== null);
  if (datees.length > 0) {
    return datees.some((phase) => phase.playedOn === aujourdHui)
      ? { nature: "aujourd_hui" }
      : { nature: "rien" };
  }

  return jourDeDebut === aujourdHui ? { nature: "aujourd_hui" } : { nature: "rien" };
}
