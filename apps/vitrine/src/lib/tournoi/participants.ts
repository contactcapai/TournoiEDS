/**
 * Qui entre dans une manche, et dans quel ordre (2026-08-24).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE MODULE EXISTE PARCE QUE LA RÈGLE ÉTAIT FAUSSE DES DEUX CÔTÉS, ET EN SILENCE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Une manche suisse se composait ainsi : `getClassementDuTournoi(...)` filtré sur
 * `!abandonne`. Deux défauts, mesurés le 2026-08-24 en relisant le moteur TFT historique
 * (`apps/tournoi-api`, l'ancienne app, RETIRÉE par la 10.7 (2026-09-01)), qui traitait le premier **explicitement** :
 *
 * ① **UN PRÉSENT QUI N'A PAS ENCORE JOUÉ ÉTAIT OUBLIÉ.** Le classement se construit depuis
 *    les `tournament_match_slot` : qui n'a jamais eu de place n'y figure pas. Quelqu'un qui
 *    rejoint au week-end 2, ou qui était absent au premier, n'entrait donc dans **aucune**
 *    table — sans erreur, sans message, sans chaise vide à compter. L'ancienne app avait la
 *    parade en toutes lettres : *« Joueurs actifs sans aucun résultat ajoutés en queue »*.
 *    ⚠️ Sur un tournoi étalé sur plusieurs week-ends, ce n'est pas un cas marginal.
 *
 * ② **UN ABSENT QUI AVAIT JOUÉ ÉTAIT REPLACÉ QUAND MÊME.** Le filtre ne retirait que les
 *    abandons. Quelqu'un qui joue le premier week-end puis ne revient pas est marqué
 *    `absent`, pas `abandonne` — il gardait donc une place à chaque manche suivante, et sa
 *    table jouait à sept en l'attendant.
 *
 * 🔴 LA PARADE EST DE PARTIR DES PRÉSENTS ET NON DU CLASSEMENT. Le classement dit l'ORDRE ;
 * c'est le pointage qui dit QUI. Les confondre, c'est laisser une liste construite pour
 * mesurer décider de qui joue.
 */

/** Une ligne de classement — l'ordre du tableau est celui du classement, du 1ᵉʳ au dernier. */
export type ClasseDuTournoi = { id: string; nom: string };

/** Un engagé pointé « présent ». */
export type EngagePresent = { id: string; nom: string };

/**
 * Les participants d'une manche composée d'après le classement (une manche suisse, une
 * finale), dans l'ordre où ils doivent être répartis.
 *
 * Deux étages, et c'est la règle du moteur historique :
 * 1. les **présents déjà classés**, dans l'ordre du classement — c'est ce qui met les
 *    meilleurs ensemble ;
 * 2. puis les **présents sans résultat**, en queue, dans leur ordre d'arrivée.
 *
 * ⚠️ Un engagé classé qui n'est **plus** présent (absent, abandon, jamais pointé) n'entre
 * pas : ses points restent au classement, sa chaise ne lui est plus réservée. Les deux faits
 * sont distincts et le modèle les sépare depuis la dette R60.
 */
export function participantsDepuisLeClassement(
  classement: readonly ClasseDuTournoi[],
  presents: readonly EngagePresent[],
): EngagePresent[] {
  const parId = new Map(presents.map((engage) => [engage.id, engage]));

  // ① Les classés qui sont encore là, dans l'ordre du classement.
  const retenus: EngagePresent[] = [];
  const dejaPris = new Set<string>();
  for (const ligne of classement) {
    const present = parId.get(ligne.id);
    if (present === undefined || dejaPris.has(present.id)) continue;
    retenus.push(present);
    dejaPris.add(present.id);
  }

  // ② Les présents que le classement ne connaît pas encore, en queue.
  for (const present of presents) {
    if (!dejaPris.has(present.id)) {
      retenus.push(present);
      dejaPris.add(present.id);
    }
  }

  return retenus;
}
