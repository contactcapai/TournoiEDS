// `server-only` en TOUTE PREMIÈRE LIGNE (doctrine posée en Story 1.7, `client.ts`) :
// l'allowlist ne doit jamais atteindre le navigateur — elle nomme les administrateurs.
import "server-only";

/**
 * Allowlist du rôle admin unique (FR27, AR-SEC2).
 *
 * 🔴 UNE ALLOWLIST VIDE REFUSE TOUT LE MONDE — JAMAIS L'INVERSE.
 * C'est l'arbitrage n°2 de la Story 6.1, et il n'est pas théorique : `AUTH_ADMIN_DISCORD_IDS`
 * est absente en CI, absente au premier `pnpm dev` d'un nouveau poste, et absente sur le VPS
 * tant que personne ne l'a posée. Si l'absence ouvrait l'accès, le back-office serait ouvert
 * à tout compte Discord de la planète **exactement dans les états où personne ne regarde**.
 * Un back-office injoignable est un incident visible ; un back-office ouvert est un incident
 * silencieux.
 *
 * ⚠️ La lecture se fait À L'APPEL et non à l'import : un module qui lirait `process.env` au
 * chargement figerait la valeur au moment du bundling et rendrait le comportement dépendant
 * de l'ordre des imports.
 */
export function identifiantsAdminAutorises(): string[] {
  return (process.env.AUTH_ADMIN_DISCORD_IDS ?? "")
    .split(",")
    .map((valeur) => valeur.trim())
    .filter((valeur) => valeur.length > 0);
}

/**
 * Le compte Discord donné a-t-il le droit d'entrer ?
 *
 * 🔴 La comparaison porte sur l'IDENTIFIANT NUMÉRIQUE Discord (`providerAccountId`), jamais
 * sur le pseudo ni sur l'e-mail : les deux se changent en un clic depuis l'application
 * Discord, l'identifiant non. Une allowlist par pseudo serait contournable par n'importe qui
 * accepterait de renommer son compte.
 */
export function estAdminAutorise(identifiantDiscord: string | null | undefined): boolean {
  if (typeof identifiantDiscord !== "string" || identifiantDiscord.length === 0) {
    return false;
  }

  const autorises = identifiantsAdminAutorises();

  // Fail-closed explicite. Le `includes` ci-dessous rendrait déjà `false` sur un tableau
  // vide — la branche existe pour que la garde soit LISIBLE et pour porter le journal :
  // sans lui, un back-office qui refuse tout le monde ressemble à une panne.
  if (autorises.length === 0) {
    console.error(
      "[auth] AUTH_ADMIN_DISCORD_IDS est absente ou vide : AUCUN compte n'est autorisé " +
        "(fail-closed volontaire, Story 6.1). Renseigner l'identifiant numérique Discord " +
        "de l'administrateur dans l'environnement.",
    );
    return false;
  }

  // ⚠️ Diagnostic ajouté après revue (Edge Case Hunter). Une valeur mal formée — espace
  // interne à la place d'une virgule (`"123 456"`), guillemets copiés-collés (`'"123"'`) —
  // échoue FERMÉ, ce qui est correct, mais rendait exactement le même symptôme qu'une
  // allowlist absente : « personne ne passe », sans dire pourquoi. Un back-office
  // injoignable dont on ne sait pas s'il est mal configuré ou vide coûte une heure.
  const malFormes = autorises.filter((valeur) => !/^\d{17,20}$/.test(valeur));
  if (malFormes.length > 0) {
    console.error(
      `[auth] AUTH_ADMIN_DISCORD_IDS contient ${malFormes.length} entrée(s) qui ne sont pas ` +
        "des identifiants Discord (17 à 20 chiffres). Attendu : des identifiants NUMÉRIQUES " +
        "séparés par des virgules, sans guillemets. Ces entrées ne correspondront jamais.",
    );
  }

  return autorises.includes(identifiantDiscord);
}
