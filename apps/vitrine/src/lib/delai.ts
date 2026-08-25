/**
 * Dire une durée à un humain (Story 8.1).
 *
 * 🔴 NÉE D'UN DÉFAUT MESURÉ SUR STAGING LE 2026-08-25, avec 222 tests au vert. Le courriel
 * de lien magique calculait toujours des minutes ; la durée de vie par défaut d'un lien
 * Auth.js étant de 24 h, il annonçait « expire dans 1440 minutes ». Exact, et illisible.
 * Une règle de formatage se trompe SANS RIEN CASSER — ni type, ni lint, ni rendu : c'est
 * précisément le cas où ce projet écrit un test.
 */

/**
 * 🔴 ON N'ANNONCE JAMAIS PLUS DE TEMPS QU'IL N'EN RESTE. Les heures sont donc TRONQUÉES et
 * non arrondies : à 1 h 50 restantes, « 2 heures » inviterait à revenir trop tard, sur un
 * lien déjà mort. « 1 heure » est faux dans l'autre sens, et c'est le sens sûr.
 */
export function delaiLisible(millisecondes: number): string {
  const minutes = Math.max(1, Math.floor(millisecondes / 60_000));
  if (minutes < 90) return `${minutes} ${minutes > 1 ? "minutes" : "minute"}`;

  const heures = Math.floor(minutes / 60);
  return `${heures} ${heures > 1 ? "heures" : "heure"}`;
}
