/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LE TIRAGE EST-IL ENCORE À JOUR ? (Story 10.13)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CE FICHIER EXISTE PARCE QU'UNE CAPACITÉ COMPLÈTE PEUT RESTER INUTILISABLE FAUTE DE
 * SIGNAL. Régénérer une manche sans résultat était déjà possible — l'action le fait, sa garde
 * est la bonne, le bouton « Effacer et refaire » est à l'écran. Mais **rien ne disait qu'il
 * fallait le presser** : le nombre de présents n'était lu qu'AVANT la génération, et une fois
 * les tables tirées, l'écran ne comparait plus jamais qui y était assis à qui était là.
 *
 * ⇒ Quelqu'un qui part après le tirage garde sa chaise, sa table joue à sept, et **les points
 * de toute la manche suivent la taille réelle de la table** (10.3) : le classement est faux
 * sans que rien à l'écran ne l'annonce. C'est le motif « un fait vrai que personne ne dit »,
 * déjà payé en 13.1.
 *
 * ⚠️ Pur, sans base : il reçoit ce que la page a déjà lu. Aucune requête nouvelle.
 */

/** Une place du tirage. `entryId` est `null` sur une place en attente de propagation. */
export type PlaceTiree = { entryId: string | null; nom: string | null };

/** Un engagé présent CE JOUR-LÀ. */
export type EngagePresent = { id: string; nom: string };

export type EcartsDeTirage = {
  /** Assis au tirage, mais plus présents — un drop, une absence. */
  partis: EngagePresent[];
  /** Présents, mais assis nulle part — arrivés après le tirage. */
  arrives: EngagePresent[];
};

const VIDE: EcartsDeTirage = { partis: [], arrives: [] };

/**
 * Ce qui a changé entre le tirage et maintenant.
 *
 * 🔴 UNE PHASE NON GÉNÉRÉE NE REND AUCUN ÉCART, ET C'EST UNE GARDE, PAS UNE OPTIMISATION.
 * Sans elle, une phase encore vide déclarerait **tous** les présents « arrivés après le
 * tirage » — un avertissement massif et faux, affiché précisément au moment où l'on s'apprête
 * à générer normalement. Le premier écran d'un jour de tournoi serait une fausse alerte.
 *
 * ⚠️ On compare des IDENTIFIANTS, jamais des noms : deux engagés peuvent porter le même nom
 * affiché (rien ne l'interdit — c'est un texte libre), et les confondre ferait disparaître un
 * écart réel. Les noms ne servent qu'à ÉCRIRE le message.
 *
 * ⚠️ Les places `entryId: null` sont ignorées : en bracket, ce sont les places en attente de
 * propagation ou les exemptions. Les compter comme « personne » n'aurait aucun sens.
 */
export function ecartsDeTirage(
  places: readonly PlaceTiree[],
  presents: readonly EngagePresent[],
): EcartsDeTirage {
  const assis = new Map<string, string>();
  for (const place of places) {
    if (place.entryId !== null) assis.set(place.entryId, place.nom ?? "Sans nom");
  }
  if (assis.size === 0) return VIDE;

  const presentsParId = new Map(presents.map((e) => [e.id, e.nom]));

  const partis = [...assis.entries()]
    .filter(([id]) => !presentsParId.has(id))
    .map(([id, nom]) => ({ id, nom }));

  const arrives = presents.filter((engage) => !assis.has(engage.id)).map((e) => ({ ...e }));

  // Ordre TOTAL : le nom, puis l'identifiant. L'écran est `force-dynamic` et se relit à
  // chaque rafraîchissement — deux homonymes ne doivent pas permuter d'une lecture à l'autre.
  const parNom = (a: EngagePresent, b: EngagePresent) =>
    a.nom.localeCompare(b.nom, "fr") || a.id.localeCompare(b.id, "fr");

  return { partis: partis.sort(parNom), arrives: arrives.sort(parNom) };
}

/** Y a-t-il quelque chose à signaler ? */
export function tirageAJour(ecarts: EcartsDeTirage): boolean {
  return ecarts.partis.length === 0 && ecarts.arrives.length === 0;
}
