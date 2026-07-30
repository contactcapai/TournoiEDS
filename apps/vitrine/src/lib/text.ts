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
