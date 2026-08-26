/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * QUEL PSEUDO PROPOSER À QUELQU'UN QUI S'INSCRIT (Story 12.3)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 LE PROFIL RANGE SES IDENTIFIANTS **PAR PLATEFORME**, LE TOURNOI NOMME **UN JEU** — et le
 * jeu est du **texte libre**, volontairement (dix jeux au dossier GIR : un enum imposerait une
 * migration à chaque tournoi). Il manque donc une traduction entre les deux, et c'est celle-ci.
 *
 * 🔴 CE QU'ELLE PRODUIT EST UNE **SUGGESTION**, JAMAIS UNE DÉCISION — et c'est ce qui rend la
 * règle acceptable malgré l'imprécision de sa source. Le champ pré-rempli reste **modifiable**
 * avant d'être validé (principe ③ de l'Epic 13 : *l'assistance montre avant d'écrire*). Une
 * suggestion ratée coûte une frappe ; c'est pourquoi on peut ici raisonner par mots-clés, là où
 * `rattachement.ts` — qui décide d'une **identité** — s'interdit tout « contient ».
 *
 * ⚠️ L'ENJEU EST RÉEL MALGRÉ TOUT : le bénévole se sert de cet identifiant pour **inviter en
 * lobby**. Un pseudo de site à la place d'un Riot ID, c'est quelqu'un qui n'entre pas dans la
 * partie — d'où le fait que ce module existe au lieu de proposer bêtement le pseudo de site.
 *
 * ⚠️ ELLE NE CONNAÎT PAS LA BASE : une chaîne entre, une plateforme sort. C'est le seul endroit
 * de cette story où une règle peut être fausse **sans que rien ne le montre**, donc le seul qui
 * se teste.
 */

/**
 * Les plateformes que `user_profile` porte — **fermées et petites**, contrairement aux jeux.
 * ⚠️ Le pseudo Discord n'en fait PAS partie : on ne joue pas « sur Discord », il sert à joindre
 * quelqu'un, pas à l'inviter dans une partie.
 */
export const PLATEFORMES = ["riot", "steam", "epic"] as const;
export type Plateforme = (typeof PLATEFORMES)[number];

/**
 * Les mots qui désignent un jeu, et la plateforme dont il porte l'identifiant.
 *
 * ⚠️ **LES MOTIFS SONT DES SUITES DE MOTS, PAS DES SOUS-CHAÎNES** — voir `contientLaSuite`.
 * Sans cela « lol » se reconnaîtrait dans « Lollipop » et « cs » dans « Clone Hero » : le champ
 * serait pré-rempli avec l'identifiant d'une autre plateforme, ce qui est pire que vide.
 *
 * ⚠️ **L'ORDRE DÉPARTAGE UN TOURNOI À DEUX JEUX** (« CS2 / Valorant » existe au dossier GIR).
 * C'est arbitraire et ça n'a pas à ne pas l'être : le champ se corrige d'un clic, et aucun autre
 * critère ne serait plus juste sans demander au bénévole une donnée de plus.
 */
const JEUX: readonly (readonly [readonly string[], Plateforme])[] = [
  // Riot — LoL, Valorant, TFT et 2XKO partagent UN compte, c'est ce qui rend la règle utile.
  [["valorant"], "riot"],
  [["league", "of", "legends"], "riot"],
  [["lol"], "riot"],
  [["tft"], "riot"],
  [["teamfight", "tactics"], "riot"],
  [["2xko"], "riot"],
  [["wild", "rift"], "riot"],
  // Steam
  [["cs2"], "steam"],
  [["csgo"], "steam"],
  [["cs", "go"], "steam"],
  [["counter", "strike"], "steam"],
  [["dota"], "steam"],
  [["speedrunners"], "steam"],
  [["boomerang", "fu"], "steam"],
  [["clone", "hero"], "steam"],
  // Epic — Rocket League a quitté Steam pour l'Epic Games Store, et c'est le compte Epic
  // qui sert à inviter.
  [["rocket", "league"], "epic"],
  [["fortnite"], "epic"],
];

/**
 * Les mots d'un intitulé de jeu, comparables : minuscules, sans accents, ponctuation réduite à
 * des séparateurs.
 *
 * ⚠️ **LES ACCENTS SONT RETIRÉS ICI, ALORS QUE `rattachement.ts` LES CONSERVE** — et les deux
 * ont raison. Là-bas ils **distinguent deux personnes** (« Rémi » n'est pas « Remi ») ; ici on
 * compare un intitulé à un catalogue de noms de jeux, où aucune paire ne se distingue par un
 * accent. Les garder ne ferait que rater « Pokémon » écrit sans accent.
 * ⚠️ `toLocaleLowerCase("fr")` et non `toLowerCase()` : le second dépend de la locale du process.
 */
function mots(intitule: string): string[] {
  return intitule
    .normalize("NFD")
    // Les diacritiques que `NFD` vient de séparer de leur lettre (U+0300–U+036F), écrits en
    // échappements : la même classe en caractères littéraux est illisible et se perd au copier-coller.
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length > 0);
}

/** La suite `motif` apparaît-elle telle quelle dans `sujet` ? */
function contientLaSuite(sujet: readonly string[], motif: readonly string[]): boolean {
  if (motif.length > sujet.length) return false;
  for (let depart = 0; depart <= sujet.length - motif.length; depart += 1) {
    if (motif.every((mot, decalage) => sujet[depart + decalage] === mot)) return true;
  }
  return false;
}

/**
 * La plateforme dont l'identifiant sert à inviter sur ce jeu — `null` si on ne sait pas.
 *
 * ⚠️ **`null` EST UNE RÉPONSE, PAS UN ÉCHEC.** Le catalogue ne couvrira jamais le texte libre :
 * un jeu inconnu retombe sur le pseudo de site, et le champ reste à remplir à la main. Deviner
 * une plateforme au hasard serait le seul comportement franchement mauvais.
 */
export function plateformeDuJeu(jeu: string): Plateforme | null {
  const intitule = mots(jeu);
  for (const [motif, plateforme] of JEUX) {
    if (contientLaSuite(intitule, motif)) return plateforme;
  }
  return null;
}

/** Les identifiants déclarés au profil, tels que la suggestion les lit. */
export type PseudosDuProfil = {
  readonly pseudo: string | null;
  readonly riotId: string | null;
  readonly steamId: string | null;
  readonly epicId: string | null;
};

/**
 * Le pseudo à pré-remplir : celui de la plateforme du jeu, **sinon** celui du site.
 *
 * ⚠️ **LE REPLI COMPTE AUTANT QUE LA RÈGLE.** Quelqu'un qui n'a rempli que son pseudo de site
 * doit voir quelque chose : une page blanche à ce moment-là, c'est le principe ④ de l'Epic 13
 * pris à l'envers. Et un profil entièrement vide rend `null` — le champ s'affiche alors vide,
 * ce qui est exact.
 * ⚠️ **AUCUN NETTOYAGE ICI** : `cleanText` reste au rendu et `texteNettoye` à la validation.
 * Une troisième copie de cette règle-là est précisément la dette R41.
 */
export function pseudoSuggere(jeu: string, profil: PseudosDuProfil | null): string | null {
  if (profil === null) return null;

  const plateforme = plateformeDuJeu(jeu);
  const surLaPlateforme =
    plateforme === "riot"
      ? profil.riotId
      : plateforme === "steam"
        ? profil.steamId
        : plateforme === "epic"
          ? profil.epicId
          : null;

  return surLaPlateforme ?? profil.pseudo;
}
