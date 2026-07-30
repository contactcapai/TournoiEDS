/**
 * Utilitaires de texte partagés du rendu public.
 *
 * Extrait de `EventHub` par la Story 3.3 : la carte du prochain rendez-vous, la ligne
 * d'événement et la page `/agenda` en ont toutes besoin — trois consommateurs, donc une
 * seule définition (règle du projet : on extrait au 2ᵉ, pas « au cas où »).
 */

/**
 * Un texte blanc n'est pas un texte.
 *
 * Le CHECK `event_has_venue` (Story 3.1) protège la BASE, pas le rendu : une ligne écrite
 * avant le durcissement Zod, ou par du SQL direct, peut porter un `venueName` d'espaces.
 * Côté affichage il doit se comporter comme absent — exactement comme le schéma Zod
 * ramène `''` à `null` côté écriture.
 */
export function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Tronque à `max` caractères, **sur une frontière de mot**, et suffixe d'une ellipse.
 *
 * 🔴 POURQUOI UNE BORNE DE LONGUEUR, ET PAS SEULEMENT UNE GARDE DE DÉBORDEMENT :
 * les vignettes du carrousel « déjà passé » (Story 3.3) doivent avoir **la même
 * hauteur**, sinon le bloc grandit et rapetisse à chaque changement de vignette. Or
 * une pile de boîtes prend la hauteur de la plus haute : sans borne, **un seul**
 * compte-rendu bavard imposerait sa hauteur aux quatre, et laisserait trois vignettes
 * aux trois quarts vides.
 *
 * ⚠️ CE N'EST PAS LA BONNE COUCHE, et c'est assumé pour l'instant : la vraie parade
 * est une longueur maximale **à la saisie**, dans le formulaire du back-office
 * (Story 6.3), pour que personne n'écrive un texte qui ne sera jamais lu en entier.
 * Ici on protège le rendu ; là-bas on protégera le contenu. Dette consignée.
 *
 * La coupure remonte au dernier espace **tant qu'elle ne mange pas plus de 40 % du
 * texte** : au-delà, c'est qu'il n'y a pas d'espace exploitable (un mot très long, une
 * URL collée) et on coupe net plutôt que de rendre presque rien.
 */
export function truncate(value: string | null | undefined, max: number): string | null {
  const clean = cleanText(value);
  if (!clean || clean.length <= max) return clean;

  const coupe = clean.slice(0, max);
  const dernierEspace = coupe.lastIndexOf(" ");
  const base = dernierEspace > max * 0.6 ? coupe.slice(0, dernierEspace) : coupe;
  // On retire la ponctuation de fin avant l'ellipse : « …, … » ou « ..… » sont des
  // artefacts de troncature, pas de la typographie.
  return `${base.replace(/[\s.,;:!?…]+$/u, "")}…`;
}
