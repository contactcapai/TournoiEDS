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
export const RESEAUX_CABLES: readonly string[] = [];

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
