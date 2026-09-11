/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CE QUE L'OUTIL DE PUBLICATION FAIT RÉELLEMENT PARAÎTRE — SOURCE UNIQUE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 LE WORKFLOW n8n `publication-reseaux.json` NE PORTE AUCUN NŒUD SOCIAL : le message est
 * reçu, validé, et **rien ne paraît nulle part**. C'est la Story 7.6 qui câble les comptes —
 * c'est elle qui remplit cette liste, **un nom par nœud effectivement vérifié**, jamais par
 * anticipation.
 *
 * ⚠️ C'est une copie à la main d'un fait qui vit hors du dépôt. Elle ne choisit que **les
 * phrases de l'écran**, et l'oubli échoue du bon côté : une liste restée vide fait dire « rien
 * n'a paru » alors que quelque chose a paru — jamais l'inverse.
 */
/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LES QUATRE RÉSEAUX, ET LEQUEL EST RÉELLEMENT RACCORDÉ — SOURCE UNIQUE (Story 7.6)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 `cable` NE SE MET À `true` QU'APRÈS UN POST RÉELLEMENT VU. Jamais parce qu'un nœud
 * existe, jamais parce qu'une API a répondu `200` — le témoin est un message **visible dans
 * le salon ou sur le compte**. C'est la doctrine du `n8n/README.md`, payée par la dette R32
 * (le SMTP entièrement câblé, jamais émis une seule fois).
 *
 * ⚠️ **C'est une copie à la main d'un fait qui vit hors du dépôt** (dans le workflow n8n), et
 * l'oubli échoue **du bon côté** : laisser `false` fait dire « rien n'a paru » alors que
 * quelque chose a paru — jamais l'inverse.
 *
 * ⚠️ **`cle` EST LA MÊME QUE DANS `messages`** (`lib/schemas/publication.ts`) : c'est elle qui
 * voyage dans le paquet et que le workflow compare. Les faire diverger enverrait une annonce
 * vers un réseau que n8n ne reconnaîtrait pas — sans erreur, sans rien qui paraisse.
 *
 * ✅ **Discord raccordé le 2026-09-10** : webhook de salon, nœud `Publier sur Discord` dans le
 * workflow, et **deux messages réellement vus** — un dans le salon de test, un dans le salon
 * d'annonces.
 */
export const RESEAUX = [
  { cle: "discord", libelle: "Discord", cable: true, exigeUneImage: false },
  { cle: "x", libelle: "X", cable: false, exigeUneImage: false },
  { cle: "facebook", libelle: "Facebook", cable: true, exigeUneImage: false },
  /**
   * 🔴 `exigeUneImage` EST UN FAIT DE L'API, PAS UNE PRÉFÉRENCE. Instagram **refuse** un post
   * sans image — mesuré le 2026-09-11 en publiant pour de vrai. Le porter ici plutôt que dans
   * un `if` du formulaire est ce qui permet aux deux chemins d'envoi (l'écran de composition
   * ET le bouton de l'agenda) d'appliquer la même règle sans la recopier.
   */
  { cle: "instagram", libelle: "Instagram", cable: true, exigeUneImage: true },
] as const;

/** La clé d'un réseau — celle qui voyage dans le paquet, jamais le libellé. */
export type CleReseau = (typeof RESEAUX)[number]["cle"];

/** Les clés des réseaux raccordés — ce vers quoi une annonce peut réellement partir. */
export const CLES_CABLEES: readonly CleReseau[] = RESEAUX.filter((r) => r.cable).map((r) => r.cle);

/**
 * Les **libellés** des réseaux raccordés — pour les phrases de l'écran, jamais pour le paquet.
 * ⚠️ Dérivée de `RESEAUX`, jamais réécrite : deux listes divergeraient au premier ajout.
 */
export const RESEAUX_CABLES: readonly string[] = RESEAUX.filter((r) => r.cable).map(
  (r) => r.libelle,
);

/** Le libellé d'une clé — « discord » → « Discord ». Pour écrire une phrase lisible. */
export function libelleDuReseau(cle: CleReseau): string {
  const trouve = RESEAUX.find((r) => r.cle === cle);
  // Le type interdit l'inconnu ; le repli existe pour une valeur venue d'ailleurs (un paquet
  // rejoué, une restauration) plutôt que de rendre `undefined` au milieu d'une phrase.
  return trouve ? trouve.libelle : cle;
}

/** « Instagram » · « Instagram et Discord » · « Instagram, X et Discord ». */
export function listerReseaux(reseaux: readonly string[] = RESEAUX_CABLES): string {
  if (reseaux.length <= 1) return reseaux.join("");
  return `${reseaux.slice(0, -1).join(", ")} et ${reseaux[reseaux.length - 1]}`;
}

/**
 * Ce que la confirmation dit AVANT le clic.
 *
 * 🔴 L'ORDRE EST « RACCORDÉ OU NON » D'ABORD, « DÉJÀ ANNONCÉ » ENSUITE — pas l'inverse. Sans
 * réseau raccordé, le rappel « confirmer publiera une SECONDE annonce » serait faux : ni la
 * première ni la seconde ne publient quoi que ce soit.
 *
 * @param annonceLeFormate date lisible du précédent envoi, `null` s'il n'y en a jamais eu.
 */
export function precisionAnnonce(
  annonceLeFormate: string | null,
  reseaux: readonly string[] = RESEAUX_CABLES,
): string {
  if (reseaux.length === 0) {
    return annonceLeFormate
      ? `⚠️ Déjà transmis le ${annonceLeFormate}. Aucun réseau n'est raccordé à l'outil de ` +
          "publication : ni cet envoi ni le précédent ne font paraître quoi que ce soit."
      : "⚠️ Aucun réseau n'est raccordé à l'outil de publication : le message part, mais " +
          "l'annonce ne paraîtra nulle part. Elle reste à publier à la main.";
  }
  const liste = listerReseaux(reseaux);
  return annonceLeFormate
    ? `⚠️ Déjà annoncé le ${annonceLeFormate}. Confirmer publiera une SECONDE annonce sur ` +
        `${liste}, que ce back-office ne sait pas retirer.`
    : `L'annonce part vers ${liste}. Elle ne peut pas être annulée depuis ici.`;
}

/** Ce que la trace dit APRÈS le clic, et qui reste à l'écran. */
export function traceAnnonce(
  dateFormatee: string,
  reseaux: readonly string[] = RESEAUX_CABLES,
): string {
  return reseaux.length === 0
    ? `Transmis à l'outil de publication le ${dateFormatee} — ⚠️ aucun réseau n'y est raccordé, ` +
        "l'annonce n'a paru nulle part."
    : `Annoncé sur ${listerReseaux(reseaux)} le ${dateFormatee}`;
}

/**
 * La fin de l'avertissement « trace non enregistrée » (revue 6.7).
 *
 * 🔴 « Vérifiez vos réseaux » était écrit en dur — donc rendu à côté de « l'annonce n'a paru
 * nulle part », deux phrases qui se contredisent sur la MÊME ligne. Motif de la PR #100.
 */
export function conseilTraceManquante(reseaux: readonly string[] = RESEAUX_CABLES): string {
  return reseaux.length === 0
    ? "Notez-le : sans cette trace, l'écran redira « jamais transmis »."
    : `Notez-le, et ne recliquez pas sans avoir vérifié ${listerReseaux(reseaux)}.`;
}

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE VERS QUOI UNE ANNONCE PART RÉELLEMENT — L'INTERSECTION, JAMAIS LA DEMANDE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Sortie de l'action et testée parce qu'elle se trompe **sans rien casser**, dans les deux
 * sens :
 *
 * ① **Filtrer la demande au lieu des raccordés.** `demandees.filter(...)` rendrait
 *    `["instagram"]` sur une demande d'Instagram — un réseau sans nœud. Le paquet partirait,
 *    n8n répondrait `200`, l'écran écrirait « Annoncé sur Instagram », et **rien** n'aurait
 *    paru. C'est le défaut de la PR #118, retourné : là on taisait une parution, ici on en
 *    inventerait une.
 * ② **Rendre une liste vide sans le dire.** Un paquet sans cible est un envoi qui ne publie
 *    nulle part. L'appelant DOIT traiter le cas comme un refus — d'où une liste vide en
 *    retour, jamais une exception silencieuse ni un repli sur « tous ».
 *
 * ⚠️ **L'ORDRE VIENT DE `RESEAUX`, PAS DE LA DEMANDE** : deux annonces identiques doivent
 * produire le même paquet, quel que soit l'ordre où les cases ont été cochées.
 */
export function ciblesRetenues(demandees: readonly string[]): readonly CleReseau[] {
  return CLES_CABLEES.filter((cle) => demandees.includes(cle));
}

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUI PARTIRA VRAIMENT, ET CE QUI SERA SAUTÉ — AVEC SA RAISON (arbitrage B)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Instagram **refuse** un post sans image. Brice a tranché le 2026-09-11 entre deux façons
 * de traiter ce cas :
 *   · **A** — refuser tout l'envoi. ⇒ **Écartée**, et pour une raison concrète : le bouton
 *     « Annoncer » de l'agenda vise *tous* les réseaux raccordés, donc un jeudi ordinaire
 *     **sans visuel** l'aurait bloqué à chaque fois.
 *   · **B** — publier ailleurs, et **le dire**. ⇒ Retenue.
 *
 * 🔴 « ET LE DIRE » EST LA MOITIÉ QUI COMPTE, ET C'EST POURQUOI CETTE RÈGLE VIT DANS LE SITE
 * ET NON DANS n8n. Le workflow peut sauter un réseau ; il ne peut pas l'écrire à l'écran de
 * celui qui clique. Un saut muet, c'est le faux succès de la PR #118 : « Annoncé sur
 * Instagram » à propos de rien.
 *
 * ⚠️ **`ignorees` N'EST PAS UN DÉTAIL D'AFFICHAGE** : un appelant qui ne rendrait que
 * `retenues` produirait exactement le silence qu'on refuse. Les deux valeurs sortent
 * ensemble pour qu'on ne puisse pas prendre l'une sans voir l'autre.
 *
 * ⚠️ n8n **refait la vérification de son côté** (condition à deux termes sur l'étage
 * Instagram) : non par défiance, mais parce qu'un paquet sans image y ferait échouer l'appel
 * — et emporterait **tout ce qui a déjà été publié** dans la même exécution.
 */
export function ciblesEffectives(
  demandees: readonly string[],
  aUneImage: boolean,
): { retenues: readonly CleReseau[]; ignorees: readonly CleReseau[] } {
  const possibles = ciblesRetenues(demandees);
  if (aUneImage) return { retenues: possibles, ignorees: [] };
  const exigeantes = new Set(RESEAUX.filter((r) => r.exigeUneImage).map((r) => r.cle as CleReseau));
  return {
    retenues: possibles.filter((cle) => !exigeantes.has(cle)),
    ignorees: possibles.filter((cle) => exigeantes.has(cle)),
  };
}

/** « Instagram exige une image : il sera ignoré. » — la phrase, ou `null` s'il n'y a rien à dire. */
export function phraseIgnores(ignorees: readonly CleReseau[]): string | null {
  if (ignorees.length === 0) return null;
  const liste = listerReseaux(ignorees.map(libelleDuReseau));
  return ignorees.length === 1
    ? `${liste} exige une image : sans elle, il sera ignoré.`
    : `${liste} exigent une image : sans elle, ils seront ignorés.`;
}
