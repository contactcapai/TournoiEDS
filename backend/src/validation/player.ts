const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PSEUDO_LENGTH = 100;

export function validatePlayerInput(body: Record<string, unknown>): string[] {
  const { discordPseudo, riotPseudo, email } = body;
  const errors: string[] = [];

  if (!discordPseudo || typeof discordPseudo !== 'string' || !discordPseudo.trim()) {
    errors.push('Le champ pseudo Discord est requis');
  } else if (discordPseudo.trim().length > MAX_PSEUDO_LENGTH) {
    errors.push(`Le pseudo Discord ne doit pas depasser ${MAX_PSEUDO_LENGTH} caracteres`);
  }

  if (!riotPseudo || typeof riotPseudo !== 'string' || !riotPseudo.trim()) {
    errors.push('Le champ pseudo Riot est requis');
  } else if (riotPseudo.trim().length > MAX_PSEUDO_LENGTH) {
    errors.push(`Le pseudo Riot ne doit pas depasser ${MAX_PSEUDO_LENGTH} caracteres`);
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Le champ email est requis');
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push("Le format de l'email est invalide");
  }

  return errors;
}
