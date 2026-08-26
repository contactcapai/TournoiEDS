/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * RETROUVER SES PROPRES INSCRIPTIONS (Story 12.1, 2/2)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CE MODULE NE RATTACHE RIEN — IL **SUGGÈRE**, ET LA DISTINCTION EST TOUTE LA STORY.
 * `tournament_entry.display_name` est du **texte libre** saisi par un bénévole ; `external_id`
 * est vide tant que MATELY n'envoie rien. Il n'existe donc **aucune clé fiable**, et rapprocher
 * automatiquement sur le pseudo donnerait l'historique d'un **homonyme** à quelqu'un — en
 * silence, ce qui est le pire des deux. Le joueur **demande**, un bénévole **valide**
 * (arbitrage de Brice, 2026-08-25).
 *
 * ⇒ Ce que ces fonctions produisent est une **liste de candidats à montrer**, jamais une
 * décision. Une suggestion fausse coûte un clic ; un rattachement faux coûte l'historique de
 * quelqu'un d'autre.
 *
 * ⚠️ ELLES NE CONNAISSENT PAS LA BASE : des chaînes entrent, des chaînes sortent. C'est ce qui
 * permet de les éprouver sans Postgres — et c'est le seul endroit de cette story où une règle
 * peut être fausse **sans que rien ne le montre**.
 */

/**
 * La forme comparable d'un pseudo.
 *
 * 🔴 **LE TAG RIOT EST RETIRÉ, ET C'EST LE CŒUR DU RAPPROCHEMENT.** Un Riot ID s'écrit
 * `Pseudo#EUW`, mais ce qu'on voit **en jeu, sur le stream et dans la feuille du bénévole** est
 * le seul `Pseudo`. Comparer les chaînes entières ne rapprocherait donc **jamais rien** sur un
 * tournoi TFT — c'est-à-dire sur le cas que cette story existe pour servir.
 *
 * ⚠️ **CASSE IGNORÉE, ACCENTS CONSERVÉS.** La casse varie d'une saisie à l'autre sans changer
 * l'identité. Les accents, eux, distinguent : « Rémi » et « Remi » peuvent être deux personnes,
 * et les confondre serait exactement l'homonymie qu'on cherche à éviter.
 * ⚠️ `toLocaleLowerCase("fr")` et non `toLowerCase()` : le second dépend de la locale du process.
 */
export function formeComparable(pseudo: string): string {
  const avantLeTag = pseudo.split("#")[0] ?? "";
  return avantLeTag.trim().toLocaleLowerCase("fr");
}

/**
 * Les clés sous lesquelles chercher les inscriptions de quelqu'un.
 *
 * ⚠️ **LES VIDES SONT ÉCARTÉS**, et c'est une garde, pas un nettoyage : un profil dont tous les
 * champs sont vides produirait la clé `""`, qui rapprocherait… tout engagé dont le nom se réduit
 * à un blanc. Sans ce filtre, un profil neuf se verrait proposer des inscriptions au hasard.
 * ⚠️ **DÉDOUBLONNÉES** : quelqu'un dont le pseudo de site et le pseudo Riot sont identiques ne
 * doit pas voir la même inscription deux fois.
 */
export function clesDeRecherche(pseudos: readonly (string | null)[]): string[] {
  const cles = new Set<string>();
  for (const pseudo of pseudos) {
    if (pseudo === null) continue;
    const cle = formeComparable(pseudo);
    if (cle.length > 0) cles.add(cle);
  }
  return [...cles];
}

/** Une inscription telle que la suggestion la manipule. */
export type InscriptionCandidate = {
  readonly id: string;
  readonly displayName: string;
};

/**
 * Parmi des inscriptions candidates, celles qui **ressemblent** à l'un des pseudos déclarés.
 *
 * ⚠️ **ÉGALITÉ, JAMAIS « CONTIENT ».** Un `includes()` proposerait « Clara » à qui déclare
 * « Cla », et surtout il rapprocherait des pseudos courts de tout le plateau. L'égalité sur la
 * forme comparable est stricte — et c'est le bénévole, ensuite, qui rattrape ce qu'elle rate.
 * Une suggestion manquante se répare en parlant à un bénévole ; une suggestion fausse, non.
 */
export function inscriptionsSuggerees<T extends InscriptionCandidate>(
  candidates: readonly T[],
  cles: readonly string[],
): T[] {
  if (cles.length === 0) return [];
  const recherche = new Set(cles);
  return candidates.filter((candidate) => recherche.has(formeComparable(candidate.displayName)));
}
