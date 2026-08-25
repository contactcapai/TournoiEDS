// `server-only` en TOUTE PREMIÈRE LIGNE (doctrine posée en Story 1.7, `client.ts`) :
// l'allowlist ne doit jamais atteindre le navigateur — elle nomme les administrateurs.
import "server-only";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * NOYAU DE SECOURS (Story 8.1) — CE N'EST PLUS LA PORTE D'ENTRÉE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 SON RÔLE A CHANGÉ, SON CODE NON. Jusqu'à la 8.1 cette liste décidait QUI SE CONNECTE
 * (`callbacks.signIn`, fail-closed). Les portes sont désormais tenues par la table
 * `user_role` ; cette liste n'accorde plus qu'une chose, `admin_site`, et pour une seule
 * raison : l'écran d'attribution des accès peut se refermer sur son dernier administrateur
 * — erreur de manipulation, révocation croisée, base restaurée d'une sauvegarde antérieure.
 * Il faut un chemin de retour qui NE DÉPEND PAS de la base.
 *
 * ⚠️ CONSÉQUENCE À NE PAS MANQUER : une allowlist vide ne ferme plus rien. Elle signifie
 * seulement « pas de secours configuré ». Le `console.error` ci-dessous a donc été réécrit :
 * tel quel, il aurait annoncé une fermeture qui n'a plus lieu — un message faux est pire
 * qu'un message absent.
 */
export function identifiantsAdminAutorises(): string[] {
  return (process.env.AUTH_ADMIN_DISCORD_IDS ?? "")
    .split(",")
    .map((valeur) => valeur.trim())
    .filter((valeur) => valeur.length > 0);
}

/**
 * Le compte Discord donné fait-il partie du noyau de secours ?
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

  // La branche existe pour porter le journal : un secours non configuré est un fait à
  // dire, pas une panne. `includes` rendrait déjà `false` sur un tableau vide.
  if (autorises.length === 0) {
    console.warn(
      "[auth] AUTH_ADMIN_DISCORD_IDS est absente ou vide : AUCUN NOYAU DE SECOURS n'est " +
        "configuré (Story 8.1). Les accès restent tenus par la table `user_role` — mais si " +
        "plus aucun compte ne porte `admin_site`, le seul recours sera un accès SQL au " +
        "serveur. Renseigner l'identifiant numérique Discord d'un responsable.",
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
